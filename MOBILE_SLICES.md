# ScoreCast Mobile — Slice Roadmap

**Status:** Stages A–D COMPLETE (2026-07-15). The app has full feature parity with the web app (minus demo mode) and was run end-to-end on a physical iPhone (Expo Go, SDK 54) against the live backend. **Stages A–E COMPLETE** (2026-07-16). Feature parity with the web app **plus push notifications**, all verified on a physical iPhone (dev build): all 4 notification types deliver, prefs honored, cold-start taps route correctly. Next: **Stage F — beta & launch** (PS3 store listing → TestFlight → App Store), then **Stage G — web decommission**. App icon/splash still placeholders (needed for PS3/TestFlight).

**Field fixes during device bring-up (2026-07-15)** — three bugs the simulator/typecheck couldn't catch, all fixed:
- **Expo Go origin 403.** better-auth rejects untrusted origins; the Expo client sends `expo-origin: exp://<lan-ip>:<port>/--/`, which the `@better-auth/expo` server plugin only auto-trusts when `NODE_ENV=development`. Prod 403'd every call. Fix: added `"exp://"` to server `trustedOrigins` (prefix-matches any Expo Go origin; safe — browsers can't forge the custom header). See MOBILE_PLAN.md §4.1.
- **Session cookie silently dropped.** The Expo client only stores the cookie if `hasBetterAuthCookies(setCookie, cookiePrefix)` passes, and its `cookiePrefix` defaults to `"better-auth"`. Server uses `"pl-predictions"`. Fix: pass `cookiePrefix: "pl-predictions"` to `expoClient`. **Any better-auth client config must match the server cookiePrefix.**
- **Navigator unmount churn.** `booted = fontsReady && !isPending` returned null when `useSession` briefly re-pended, unmounting the whole navigator repeatedly. Fix: latch `booted` once true.
- Also fixed a client bug where any 403 was mapped to EMAIL_NOT_VERIFIED (mis-routed origin-rejected logins to the verify screen).
**Parent document:** `MOBILE_PLAN.md` — all decisions, rationale, and specs live there; section references below (§) point into it. This document adds exactly one thing: **execution order**, cut into slices. When the two disagree, MOBILE_PLAN.md wins and this file gets fixed.

---

## How this document works

### Slice conventions

- A **slice** is one sitting of work that ends in a single commit. The repo is runnable after every slice (backend deploys clean, app builds and boots).
- Every slice has an **exit criterion** — an observable fact, not a vibe. A slice without a verifiable exit criterion is not a slice.
- Slices are ordered by dependency, not importance. Do them top to bottom unless a slice's *Depends on* says otherwise.
- When a slice ships, tick it in the tracker (§ Tracker) and note the commit hash.

### Two kinds of slices

**Build slices (`MS*`)** — write code, migrate schema, ship screens. Normal slices.

**Planning slices (`PS*`)** — the deliverable is a **document, and that document must itself be a slice plan**. MOBILE_PLAN.md deliberately deferred four areas (design, push, store listing, decommission) to follow-up docs. This roadmap does not pretend to know how those areas decompose — instead, each PS slice produces the plan that does. The rule:

> A planning slice is **done** only when its output document contains a numbered slice table of its own — child slices with the same conventions as this file (one commit each, dependency-ordered, verifiable exit criteria). The final task of every PS slice is to **register those child slices back into this file's tracker** so there is exactly one place to see project status.

Child slice series and their parent planning slice:

| Series | Planned by | Domain |
|---|---|---|
| `DS*` | PS1 → `MOBILE_DESIGN_SPEC.md` | Design system + screen visual specs |
| `NS*` | PS2 → `PUSH_SPEC.md` | Push notifications (backend + client) |
| `LS*` | PS3 → `STORE_LISTING.md` | Store assets, listing copy, review package |
| `XS*` | PS4 → decommission (runbook is MOBILE_PLAN §8 unless PS4 finds it insufficient) | Web teardown |

Build slices that depend on a child series say so (e.g. MS8 executes `DS*` slices). If a PS slice's plan discovers that a build slice below is mis-cut, amend this file in the same commit as the plan — this roadmap is living, the conventions are not.

---

## Stage A — Backend groundwork (web app untouched and live throughout)

### MS0 — Security check & repo scrub ✅ *(§2)* — shipped 2026-07-15
As cut, this slice assumed leaked secrets. Verification (step one of the slice) disproved the premise: `backend/.env` was never tracked, the live secret values appear nowhere in git history, and the tracked `.env.example` files hold placeholders only — checked against the full history of the **public** GitHub repo. Rotation and history purge therefore dropped. Done instead: history-wide secret-value grep + credential-pattern sweep of tracked files (clean), deleted the untracked SQLite artifacts (`data.db`, `sqlite.db`, `test-data.db`), confirmed `.gitignore` coverage. §2 of MOBILE_PLAN.md rewritten to match reality.
**Exit (met):** zero secret-value occurrences in `git rev-list --all`; `git ls-files` shows only `.env.example`; SQLite artifacts gone; plan docs corrected.

### MS1 — Backend hygiene ✅ *(§4.6)* — shipped 2026-07-15
Done: `GET /health` (registered before the limiters so platform probes are never throttled); general limiter 100 → 1000/15min and auth limiter 100 → 300/15min (covers frequent `get-session` traffic), both env-overridable (`RATE_LIMIT_GENERAL_MAX` / `RATE_LIMIT_AUTH_MAX`) and now returning JSON errors; deleted `middleware/sanitize.ts` (orphaned — never mounted, and the better-auth `user.create.before` hook already does its job); new `hygiene.test.ts` exercises both limiters for real via `TEST_ENABLE_RATE_LIMIT` + dynamic app import.
**Exit (met):** 131 backend tests green incl. 4 new (health 200, auth-limit 429, general-limit 429, health exemption); sanitize.ts gone. Prod verified 2026-07-15: `https://api.scorecast.club/health` → 200 `{"status":"ok"}` and auth lookup smoke test passes post-deploy.

### MS2 — Native auth transport ✅ *(§4.1)* — shipped 2026-07-15
No upgrade needed: `@better-auth/expo@1.4.17` exists as an exact peer match for the pinned `better-auth@1.4.17` (installed `--save-exact --legacy-peer-deps`; its Expo peer deps are client-side only). Wired `expo()` into the betterAuth plugins; `scorecast://` (exported as `APP_SCHEME_ORIGIN`) added to both `trustedOrigins` and the Express CORS allowlist — the CORS layer would otherwise 500 any request carrying the scheme origin before better-auth saw it. New `native-auth.test.ts` proves scheme-origin requests pass both gates (and unknown origins still get rejected).
**Exit (met):** 134 backend tests green incl. 3 new; prod verified post-deploy — scheme-origin sign-in reaches credential validation (401, not 403/500) and web auth path unchanged.

### MS3 — Email verification OTP ✅ *(§4.2)* — shipped 2026-07-15
Done: `emailOTP` plugin (6-digit, 10-min expiry, 5 allowed attempts) wired into `better-auth`; branded OTP email via `sendEmail()` (same visual family as the link email, code in a `data-otp` span); the legacy link flow stays enabled in parallel for the web app. Endpoints: `POST /api/auth/email-otp/send-verification-otp` and `.../verify-email`. **MS1 finding fixed**: `sendEmail` now captures to an in-memory `testOutbox` under `NODE_ENV === "test"` instead of calling Resend — the suite no longer burns the daily quota. `.env.example` documents the rate-limit knobs from MS1.
**Exit (met):** 139 backend tests green incl. 5 new (happy path incl. post-verify sign-in unlocked, wrong code, expiry, attempt lockout, resend-invalidates-previous, legacy-link-still-sent) — and zero Resend traffic in test output. Prod verified 2026-07-15: `POST /api/auth/email-otp/send-verification-otp` → 200 post-deploy.
**Cleanup owed:** prod-verify created one throwaway unverified user (`otp-prodcheck-1784156177@example.com`, an `@example.com` address so no real email was sent). No deletion endpoint exists yet — remove it when MS5 lands (or via a quick manual `DELETE FROM "user"`).

### MS4 — `/api/user/me` + admin consolidation ✅ *(§4.4)* — shipped 2026-07-15
Done: new `GET /api/user/me` (requireAuth) returns the full profile (id, email, name, username, first/last, emailVerified, favoriteTeamId) + server-computed `isAdmin`, never leaking credential material. New `src/lib/admin.ts` is the single source of truth: `isAdmin(email)` + `requireAdmin` middleware, reading `ADMIN_EMAILS` (canonical) with `ADMIN_EMAIL` as a one-deploy deprecation fallback, **case-insensitive**. Rewired both call sites: `admin.ts` (dropped its inline `requireAdmin`) and `leagues.ts` (all four `user.email !== ADMIN_EMAIL` checks — previously case-*sensitive*, a latent lockout bug).
**Exit (met):** 143 backend tests green incl. 4 new (`/me` 401 unauth, isAdmin false/true, no password leak, helper honors both vars case-insensitively); existing admin + leagues tests still pass. Prod verified post-deploy: `/api/user/me` returns the profile with `isAdmin`.

### MS5 — Account deletion ✅ *(§4.3)* — shipped 2026-07-15
Done: migration `007_user_delete_cascade` audited every FK to `user(id)` and fixed the ON DELETE actions (all were bare NO ACTION, blocking deletion) — `prediction`/`league_member`/`user_gameweek_score`/`user_league_standing` → CASCADE, `league.createdBy` → SET NULL (leagues survive their creator; column made nullable), and defensively `session`/`account` → CASCADE (db.ts already cascades in prod, but a pre-cascade DB or the test fixture would otherwise block deletion). The migration matches FK constraints via `pg_catalog` (names are auto-generated) and is idempotent. Custom `DELETE /api/user/account` (requireAuth) clears email-keyed `verification` rows then deletes the user in one `withTransaction`; cascades do the rest. `verification` needs no FK (keyed by email).
**Exit (met):** test creates admin+member+league+push token, deletes the member → user gone, memberships/tokens/session cascaded to zero, the admin's league survives; separately, deleting a league's creator nulls `createdBy` while the league persists. (7 tests, incl. MS6.) Prod verified post-deploy: `DELETE /api/user/account` unauth → 401; migrations 007/008 ran on boot (health green).
**Cleanup still owed:** the endpoint only deletes *self* (needs the caller's session), so it can't remove MS3's two orphan `otp-prodcheck-*@example.com` users without their credentials — do a manual `DELETE FROM "user" WHERE email LIKE 'otp-prodcheck-%'` on the prod DB, or ignore (harmless unverified rows).

### MS6 — Push-token registry ✅ *(§4.5, schema only — senders wait for NS\*)* — shipped 2026-07-15
Done: migration `008_push_tokens` (`push_token` table, one row per device, `token` UNIQUE, `platform` CHECK ios/android, `userId` → user ON DELETE CASCADE, index on userId). `routes/push.ts`: `POST /api/push/register` (upsert on token — Expo tokens rotate/move between users), `DELETE /api/push/register` (scoped to caller). Pruning + `tokensForUser` helpers exported for the NS* sender service. Mounted at `/api/push`.
**Exit (met):** register/unregister round-trip green; re-register upserts to a single row; a bad platform 400s; unauth 401s; user deletion (MS5) removes their tokens. (Numbered `008`, not `007` as the plan tentatively named it — 007 became the cascade migration.)

**Stage A gate:** backend is fully mobile-ready; the live website has not changed behavior once.

---

## Stage B — App foundation

### DS1 — Design foundations ✅ *(design spec §2)* — shipped 2026-07-15 (with MS7)
Done: `src/constants/theme.ts` — every §2 token (color incl. per-competition tint sets + `competition` map, 9-style type scale, `tabularNums`, spacing/layout/radius/shadow/motion, `MAX_FONT_SCALE`). Plus the DS1 primitives: `constants/fonts.ts` (Plus Jakarta Sans load map), `components/Text.tsx` (variant+color text primitive with Dynamic-Type clamp + auto tabular numerals), `components/Skeleton.tsx` (Reduce-Motion-aware pulse + `SkeletonLines`), `utils/haptics.ts` (the §2.3 intent map). Ionicons wired.
**Exit (met):** `app/gallery.tsx` renders the token sheet — all 21 palette swatches, all 9 type styles, the spacing/radius/shadow samples, and the Skeleton — bundled into the iOS build (verified via `expo export`).

### PS1 — Write `MOBILE_DESIGN_SPEC.md` ✅ 🗎 *(§6, §10)* — shipped 2026-07-15
Done: `MOBILE_DESIGN_SPEC.md` — final token set (color incl. per-competition tints, 9-style type scale, geometry/motion/haptics), all 15 §6.3 components specced with anatomy + every state, all 12 §5.4 screens specced with layouts/states/copy, app icon + splash direction, a11y checklist. Cut into **DS1–DS9**: DS1 foundations (lands in MS7), DS2–DS4 the concrete decomposition of MS8, DS5–DS7 visual passes closing Stages C/D, DS8–DS9 icon/splash + motion/a11y audit gating TestFlight.
**Exit (met):** spec covers every screen and component; `DS*` registered in the tracker below.

### MS7 — Expo scaffold ✅ *(§5.1, §5.2)* — shipped 2026-07-15
Done: `mobile/` Expo app, **TS strict**, Expo Router with `(auth)`/`(tabs)` groups + placeholder screens (login lockup, Leagues, Account), root layout wiring fonts/splash/`QueryClientProvider`/`SafeAreaProvider`/`GestureHandlerRootView`, `lib/config.ts` (`EXPO_PUBLIC_API_URL` → falls back to prod), `lib/api.ts` (ported `apiFetch` — RN-adapted, session via header not cookie), `lib/auth.ts` (better-auth Expo client + SecureStore, **pinned 1.4.17 to match backend**), `lib/queryClient.ts`. Bundle id `club.scorecast.app`, scheme `scorecast`.
**⚠ Deviation from plan §5.1:** scaffolded on **Expo SDK 57 / RN 0.86 / React 19.2** (current `create-expo-app` stable), not SDK 54 — latest-stable is the right call for a new app and still satisfies better-auth's Expo peer ranges. Routes live under `src/app/` (template's `src/` convention), a cleaner variant of the plan's `app/`+`src/` split. Docs (§5.1) updated to match.
**Exit (met, code-verified):** strict `tsc --noEmit` clean; **full iOS bundle via `expo export` succeeds** (whole module graph + Hermes compile); `expo-doctor` 18/18. `app/debug.tsx` fetches `/health` via Query and renders it. *On-simulator visual boot is the user's step (first `expo run:ios` native build — Xcode/CocoaPods — best on the Mac).*

### MS8 — Component library ✅ *(§6.3 = DS2+DS3+DS4)* — shipped 2026-07-15
All 15 components built to spec, token-only, each demoed in `app/gallery.tsx` in its documented states:
- **DS2 (form & feedback):** `Button` (5 variants × default/pressed/disabled/loading), `TextField` (focus ring, error line, secure toggle), `Banner` (error/offline/success/info), `EmptyState`, `Sheet` (Modal bottom sheet, backdrop-close).
- **DS3 (layout):** `Card` (+rail, pressable), `ScreenHeader` (large + nav variants), `SegmentedControl` (animated active pill, selection haptic), `StatTile`.
- **DS4 (domain):** `TeamCrest` (expo-image + initials fallback), `CountdownCard` (6 states: normal/<24h warning/<1h danger/passed/live/loading, live tick), `MatchRow` (scheduled/live/finished + red cards + points slot), `ScoreInput` (single-digit gate, locked/final states, ref-based auto-advance), `PointsBadge` (exact/result/incorrect/pending — replaces the web's Tailwind color helper), `LeaderboardRow` (top-3 tint, own-row highlight, champion trophy). Ported the pure domain types/helpers (`getTimeRemaining`, `calculatePredictionPoints`, `formatRank`, `POINTS`) to `src/types/`.
**Exit (met, code-verified):** strict `tsc` clean; full iOS `expo export` bundles the whole component graph; TeamCrest's SVG assumption confirmed — 5 real `crests.football-data.org` crest URLs all return `image/svg+xml` (+ a PNG variant). On-device visual pass is folded into DS5–DS7 as the screens land.

**Stage B gate:** an empty but branded, navigable app shell with a complete component kit.

---

## Stage C — Auth & onboarding

### MS9 — Auth client + login ✅ *(§5.4 login, §4.1)* — shipped 2026-07-15
Done: `lib/validation.ts` (Zod schemas, limits mirror backend); `loginWithIdentifier` in `lib/auth.ts` (two-step: `lookup-email` → `signIn.email`, normalizes failures to a typed `AuthError` with codes RATE_LIMITED / INVALID_CREDENTIALS / EMAIL_NOT_VERIFIED / NETWORK / UNKNOWN, carrying the email on unverified so login can hand off to verify); real login screen (RHF + `zodResolver`, `BrandLockup`, `TextField`/`Button`/`Banner`, KeyboardAvoiding, error copy per code); **root-layout auth gate** (`RootNavigator` gates on `useSession` + segments: signed-out→auth, signed-in→tabs, splash held until fonts+session resolve); sign-out wired into the Account tab. Placeholder `signup`/`verify` routes added so links resolve (MS10 fills them).
**Exit (code-verified):** strict `tsc` clean (confirms the better-auth client API surface — `signIn.email` result, `useSession`, `signOut`); iOS `expo export` bundles; **live prod check of the flow's first step** — `lookup-email` echoes an email identifier (200) and 401s an unknown username (→ INVALID_CREDENTIALS), exactly as the mapping expects. *On-device login→tabs, relaunch-persists, and sign-out→login are the user's step (need a verified account + simulator).*

### MS10 — Signup + OTP verify ✅ *(§5.4 signup/verify, §4.2)* — shipped 2026-07-15
Done: added `emailOTPClient` + `inferAdditionalFields` to the auth client; helpers `signUpWithDetails` (maps errors incl. USER_EXISTS), `sendVerificationCode`, `verifyEmailCode`; `lib/pendingCredentials.ts` (in-memory holder so verify auto-signs-in without putting the password in nav params). Signup screen (RHF+Zod, first/last/username/email/password/confirm, USER_EXISTS→login link). `OtpInput` component (6 boxes over one hidden field for iOS `oneTimeCode` autofill + paste). Verify screen (sends code once on mount — single source for both signup and login-unverified paths; auto-submit on 6th digit; 60s resend cooldown; post-verify `signIn.email` with held password). Login's EMAIL_NOT_VERIFIED path now stashes credentials + routes to verify.
**Exit (met):** strict `tsc` clean (validates emailOTP client API + additional-field typing); iOS `expo export` bundles; **full flow proven over real HTTP** against a local backend on the exact RN-client endpoints — signup 200 → `email-otp/send-verification-otp` 200 → wrong code 400 → correct code 200 → post-verify `sign-in` 200. Backend `email-otp.test.ts` (7 tests) covers the same server-side. *On-simulator visual + iOS autofill are the user's step.*
**Closes MS9's gap:** the app can now create + verify a real account, yielding credentials to exercise the MS9 login loop on-device.

### MS11 — Team-select gate ✅ *(§5.4 team-select)* — shipped 2026-07-15
Done: **first data-query layer** — `lib/queries/user.ts` (`useFavoriteTeam(enabled)`, `useTeams`, `useSetFavoriteTeam` mutation invalidating favorite-team) + `queries/index.ts` barrel (the "components import from @/lib/queries" convention starts here). `team-select.tsx` — `FlatList` 3-col crest grid (competition-colored fallback), selected preview + Continue, loading skeletons, error/save Banners, haptics. **Root gate extended**: `useFavoriteTeam` (enabled only when signed in), `ready` also waits on team status so onboarding routing settles under the splash; signed-in + `favoriteTeamId == null` → forced to `team-select`, set-and-invalidate releases to tabs. On a favorite-team fetch error the user isn't trapped (`needsTeam = false`).
**Exit (met):** strict `tsc` clean (Query hook types + gate); iOS `expo export` bundles; both endpoints the queries hit are live + auth-protected on prod (`/api/user/teams`, `/api/user/favorite-team` → 401 unauth). *On-device: force-through-once, persistence, and existing-user-skip are the user's visual step.*
**Known minor:** a sub-second blank (bg-colored) can show while the favorite-team query loads right after login/verify (gate renders null until `ready`); acceptable for a once-per-session path, revisit if it reads poorly on device.

**Stage C gate:** signup → verify → team → tabs and login/logout loops work end-to-end against the local backend.

---

## Stage D — Core product

### MS12 — Leagues home ✅ *(§5.4 home)* — shipped 2026-07-15
Done: query layer expanded — `queries/fixtures.ts` (`useCurrentGameweek`), `queries/leagues.ts` (`useLeagues` coercing SQL `memberCount`, `useJoinLeague`), `queries/leaderboard.ts` (`useLeaderboard`), `types/leagues.ts` (+ `upcomingDeadline` helper picking current-or-next deadline). `(tabs)/index`: greeting + favorite-team crest header, PL + UCL `CountdownCard`s (live tick, loading + season-over states), league cards (name, competition badge, member count, and the user's own rank + points pulled from each league's leaderboard), empty state → Join CTA, pull-to-refresh. Placeholder `league/[id]` + `league/join` routes (MS13/MS14).
**Depends on:** MS11.
**Exit (met, code-verified):** strict `tsc` clean; iOS `expo export` bundles. On-device visual is the user's step.
**Gotcha logged:** expo-router typed routes only discovered the `league/` folder once it had a `_layout.tsx` — without it, `.expo/types/router.d.ts` omitted the routes and `router.push("/league/…")` failed tsc. **Nested route folders need a `_layout`.** A stale `.expo/types` also causes phantom route-type errors; `rm -rf .expo` + regen fixes it.
**Deferred:** `CountdownCard` interval isn't paused on blur (`useFocusEffect`) yet — fine for an always-visible home; revisit if CPU shows up.

### MS13 — League detail: Fixtures + Table ✅ *(§5.4 league detail)* — shipped 2026-07-15
Done: `useGameweek` query (+ `GameweekDetail`/`Matchday` types). `league/[id]`: nav header with info button, `SegmentedControl` (Fixtures / Predictions / Table, competition-tinted active). **Fixtures pane** — gameweek matchdays grouped by day (date headers + `MatchRow`s in a card, kickoff/FT/live/red-card states). **Table pane** — full standings via `useLeaderboard` (`LeaderboardRow`, own row highlighted, champion trophy when `isSeasonComplete`). **Predictions pane** — deadline `CountdownCard` + "Make/edit predictions" brand button (→ predict, disabled past deadline); the predictions list itself is MS15. **Info sheet** — invite code in a tap-to-copy box (`expo-clipboard` + haptic + "Copied!"), competition + member count. Placeholder `league/predict` route registered.
**Exit (met, code-verified):** strict `tsc` clean; iOS `expo export` bundles; discovered `/league/predict` in typed routes. On-device visual (side-by-side vs web, copy code) is the user's step.

### MS14 — Join + admin surfaces ✅ *(§5.4 join/create/members)* — shipped 2026-07-15
Done: `useMe` (server-computed `isAdmin`), `useCreateLeague`/`useUpdateLeague`/`useLeagueMembers`/`useKickMember`. **`league/join`** modal — invite-code field (auto-uppercase, A–Z0–9, ≤8), join → navigate to the league, 404/"already member" error mapping. **`league/create`** modal (admin-only, double-gated: hidden unless `me.isAdmin`, server also enforces) — name + PL/UCL segmented, create → navigate. **`league/manage`** — rename (save when changed) + member roster with `Alert.alert`-confirmed kick (hidden for self and other admins). Entry points gated on `isAdmin`: "+ Create" on the Leagues home, ⚙️ Manage in league-detail header when `league.role === "admin"`.
**Exit (met, code-verified):** strict `tsc` clean; iOS `expo export` bundles; typed routes discover create/manage/join/predict; `/api/user/me` + `/api/leagues` 401 unauth on prod. Non-admins never see Create/Manage (UI gate + server 403). On-device join/create/rename/kick is the user's step.

### MS15 — Predictions entry ✅ *(§5.4 predict)* — shipped 2026-07-15
Done: `usePredictions` + `useSubmitPredictions` (invalidates predictions + leaderboard); `UserPrediction` type + `outcomeFromPoints` helper. **`league/predict`** — full entry flow: matches grouped by matchday, two `ScoreInput`s per match with ref-based auto-advance (home→away→next match), seeded from existing predictions, sticky submit bar with "X/Y entered" count, haptic on success → back. Locked/final states when deadline passed or match finished. Server re-checks deadline; its 400 surfaces as a "deadline has passed — locked" banner. **League-detail Predictions pane** now shows the saved predictions read-only (predicted score per match + `PointsBadge` once settled) instead of a placeholder.
**Exit (met, code-verified):** strict `tsc` clean; iOS `expo export` bundles; predictions endpoint 401 unauth on prod. **Core loop complete** — predict → submit → view points. On-device round-trip vs web (submit here, see it on web; points match after scoring) is the user's step.

### MS16 — Account screen ✅ *(§5.4 account, §4.3)* — shipped 2026-07-15
Done: `useUpdateUsername` (409→"taken", invalidates `/me` — no reload) + `useDeleteAccount` (MS5 endpoint). `(tabs)/account`: profile header (favorite crest or initial + name + @username), stat tiles (leagues count, team), username edit, favorite-team change via a `Sheet` crest grid (`useSetFavoriteTeam` also invalidates `/me`), account info (name/email/verified), notification-preference `Switch`es (local-only placeholders, labeled "arrive in a later update" — real storage is `NS*`), sign out, and **Delete account** (destructive `Alert` confirm → DELETE → `qc.clear()` + `signOut()` → gate redirects to login).
**Exit (met, code-verified):** strict `tsc` clean; iOS `expo export` bundles; `/api/user/username` + `/api/user/account` 401 unauth on prod. Username reflects via `/me` invalidation (no relaunch); delete signs out and the deleted session can't re-auth (MS5 cascade already tested server-side). On-device round-trip is the user's step.
**🎉 Stage D complete — full feature parity with the web app** (minus demo mode, by decision §0).

**Stage D gate: feature parity with the web app** (minus demo mode, by decision §0). Everything before P6 ran on the simulator; from here on a physical iPhone and the Apple Developer account are required — **enroll now if not already done ($99, verification can take days)**.

---

## Stage E — Push (the one net-new feature)

### PS2 — Write `PUSH_SPEC.md` ✅ 🗎  *(§7, §10)* — shipped 2026-07-15
Done: `PUSH_SPEC.md` resolves every §7 open decision — Expo Push transport; **`push_log` table** for dedup (unique per user/kind/subject/league); **`notification_pref` table** (per-user, not per-device); **no quiet hours** in V1; prune on `DeviceNotRegistered` (send + receipt check); permission prompt **contextual after first prediction**. Final copy for all 4 types. `notifyIfAllowed` choke point (pref-gate + dedup + send). Ends in the NS1–NS6 slice table (below), registered into this tracker.

### NS1 — Push infra + prefs ✅ *(PUSH_SPEC §7)* — shipped 2026-07-15
Done: `expo-server-sdk@6`; migrations `009_notification_pref` (per-user, all-on default) + `010_push_log` (UNIQUE(user,kind,subject,league) = dedup); `services/pushCopy.ts` (copy fns); `services/push.ts` — `notifyIfAllowed` choke point (pref-gate → `push_log` insert-or-skip → send) with a `pushTestOutbox` (test-mode capture, like the email module) + real Expo chunked send + `DeviceNotRegistered` prune; `routes/notifications.ts` `GET/PUT /api/notifications/prefs`. Test DB fixture drops the two new tables so their FKs regenerate.
**Exit (met):** 6 new tests green (156 total) — dedup (double send → 1), per-league separation, disabled-category gating, prefs defaults/upsert/round-trip, 401 unauth. `tsc` build clean.

### NS2 — Deadline reminder cron ✅ *(PUSH_SPEC §4)* — shipped 2026-07-15
Done: `services/notifications.ts` `runDeadlineReminders()` — scans gameweeks with a deadline in [now+23.5h, now+24h] (`deadline_24h`) or [now+0.5h, now+1h] (`deadline_1h`), and for each league of that competition, `notifyIfAllowed`s only members with **zero predictions** for the gameweek. Deadline times shown in Jordan time (Asia/Amman). Scheduled `*/30 * * * *` in `index.ts`.
**Exit (met):** 2 tests — only the unsubmitted member is notified (once), correct kind per window, re-run dedups (one `push_log` row). Full suite 158 green (caught + fixed a test-isolation bug: the seed must use `isCurrent=false` to avoid colliding with other tests' current-season queries).

### NS3 — Results + GW-complete triggers ✅ *(PUSH_SPEC §4)* — shipped 2026-07-15
Done: refactored `push.ts` into composable pieces (`prefAllows`, `claimLog`, `sendToUser`; `notifyIfAllowed` now composes them). `notifyResults(matchIds)` — groups a user's newly-scored matches per league and sends **one** batched push (single-match copy vs "N results in — X pts"); `push_log` per match dedups across the 15-min re-score cadence. `notifyGameweekComplete()` — fires once per member per league when a gameweek's matches are all finished, with their gameweek rank + points. Both wired into `runResultsUpdate` (best-effort, non-blocking).
**Exit (met):** 2 tests — batched results (2 matches → 1 push), idempotent re-run sends nothing, `gw_complete` once per member per league. Full suite 160 green.
**⚠️ Prod bug caught by the test:** `notifyGameweekComplete` originally had no time bound → on first deploy it would notify every member about every historically-complete gameweek. Fixed with a "match settled in the last 3h" guard so only recently-completed gameweeks fire (dedup handles the rest).

### NS4 — Client register + tap-routing ✅ *(PUSH_SPEC §5)* — shipped 2026-07-16
Done: EAS project linked (`eas init` → projectId in app.json, owner qadzilla); `expo-notifications` installed + config plugin. `lib/notifications.ts` — foreground handler; `registerIfGranted()` (app-start, token → `POST /api/push/register`); `maybePromptForPush()` (soft pre-prompt → OS dialog, only when undetermined — no nag); `unregisterPush()` (before sign-out); `usePushObserver()` (tap + cold-start → `/league/[id]` from `data.leagueId`). Wired: register on session in root layout, `usePushObserver` in root, prompt after first prediction submit, unregister in account sign-out.
**Exit (code-verified):** strict `tsc` clean; iOS `expo export` bundles. Degrades gracefully in Expo Go (push token throws → caught; app unaffected). **Real registration + tap needs a dev build — verified in NS6.**

### NS5 — Preference toggles ✅ *(PUSH_SPEC §5)* — shipped 2026-07-16
Done: `queries/notifications.ts` — `useNotificationPrefs` (GET) + `useUpdateNotificationPrefs` (optimistic PUT with rollback). Account screen's three switches now read/write the server prefs (replacing the local-only placeholder state); removed the "arrive in a later update" caption.
**Exit (code-verified):** strict `tsc` clean; iOS `expo export` bundles; `/api/notifications/prefs` live on prod (NS1). Toggles persist server-side (round-trip verified against NS1's endpoint tests); a disabled category is gated by NS1's `prefAllows`. On-device persist-across-relaunch is the user's step.

### NS6 — On-device delivery pass ✅ 🍎 *(PUSH_SPEC §7)* — shipped 2026-07-16
Done: EAS dev build (`eas build --profile development --platform ios`, EAS-managed credentials incl. the shared APNs push key) installed on a physical iPhone. Verified on-device: permission grant → `push_token` registered (`devices: 1`); **all 4 notification types delivered** (real `pushCopy` via a temporary secret-guarded admin-only test endpoint — since removed); notifications arrive with the app foregrounded, backgrounded, and **fully quit**; **tap cold-launches into the correct league**.
**Fix found on-device:** cold-start tap-routing dropped the deep link because `getLastNotificationResponseAsync` fired before the navigator/gate settled — gated it on `booted` + a short delay. Also added a project `.npmrc` (`legacy-peer-deps=true`) so EAS installs tolerate the zod optional-peer conflict.
**Exit (met):** all 4 types received on a real iPhone; cold-start taps route correctly. **🎉 Stage E COMPLETE.**

**Stage E gate:** push works on-device; §11 P6 exit criteria met.

---

## Stage F — Beta & launch

### PS3 — Write `STORE_LISTING.md` 🗎  *(§9, §10)*
**Planning slice.** App name/subtitle/keywords/description, screenshot plan (6.7" + 6.1"), icon + splash final assets (direction came from PS1), privacy-policy page content, App Store privacy-label answers, review-notes text including the test account and the no-stakes/no-gambling statement (§9.7). **Must end in an `LS*` slice table** — expected shape: icon+splash assets → privacy page live at scorecast.club → screenshots → App Store Connect listing filled → review package (test account seeded + notes). Register `LS*` into the tracker.
**Depends on:** Stage D gate (screens must exist to screenshot); can overlap Stage E.
**Exit:** `STORE_LISTING.md` exists, ends in an `LS*` slice table, tracker updated.

### MS17 — TestFlight  *(§11 P7)*
Production EAS profile, icon/splash wired (from `LS*`), version/build numbering, crash reporting decision executed (default per §12: `sentry-expo`), internal TestFlight distribution to the real league group.
**Depends on:** Stage E gate, `LS*` asset slices.
**Exit:** a non-developer installs via TestFlight and completes signup → predict → receives a result push, with the session surviving an app update.

### MS18 — Beta hardening
Deliberately unscoped buffer: fix what TestFlight surfaces. Cut into ad-hoc slices as issues arrive; log each as `MS18.x` in the tracker.
**Depends on:** MS17.
**Exit:** zero known crashers; beta group has used it across ≥1 full real gameweek (deadline → predictions → results → pushes).

### MS19 — App Store submission  *(§9)*
Submit with the `LS*` review package; respond to review; iterate.
**Depends on:** MS18, all `LS*`.
**Exit:** **app live on the App Store.** This is the gate for Stage G — nothing below starts before it.

---

## Stage G — Web decommission (only after MS19)

### PS4 — Decommission check 🗎  *(§8, §10)*
**Planning slice (small).** Re-read §8 against reality post-launch. If the checklist still holds, this slice's output is a dated note in this file saying so and the `XS*` slices below stand as written. If launch changed anything, write `DECOMMISSION_RUNBOOK.md` and re-cut `XS*` from it.
**Depends on:** MS19.
**Exit:** either a confirmation note here or a runbook ending in a revised `XS*` table.

### XS1 — Static landing page
Replace the scorecast.club web app with one static page: App Store badge, privacy policy, support contact (content from `LS*`). Vercel keeps hosting it.
**Exit:** scorecast.club serves the static page; the old web app is unreachable; privacy-policy URL in App Store Connect resolves.

### XS2 — Delete `frontend/`
Remove `frontend/` and its test suite from the repo. Nothing may be ported after this — anything missed was Stage D's failure to catch.
**Exit:** repo builds/tests green with no `frontend/`; `git grep -i vite` finds only historical docs.

### XS3 — Backend web-era cleanup  *(§8.4)*
Remove web origins from `CORS_ORIGIN`/`trustedOrigins`; delete the link-verification flow + `callbackURL` rewrite (OTP becomes the only path); drop `sameSite:"none"` cross-origin cookie config; README rewrite (architecture diagram, kill "Live at scorecast.club" web framing).
**Depends on:** XS1 (verification emails must not break while web signup still theoretically reachable), XS2.
**Exit:** backend tests green; a fresh mobile signup→OTP→login works in prod; **project complete.**

---

## Tracker

Planning slices register their children here (PS1 → `DS*`, PS2 → `NS*`, PS3 → `LS*`, PS4 → `XS*` revisions). One table, one source of status truth.

| Slice | Title | Stage | Status | Commit |
|---|---|---|---|---|
| MS0 | Security check & repo scrub | A | ✅ 2026-07-15 | 7234062 |
| MS1 | Backend hygiene | A | ✅ 2026-07-15 | f83738d |
| MS2 | Native auth transport | A | ✅ 2026-07-15 | bb64b5f |
| MS3 | Email verification OTP | A | ✅ 2026-07-15 | 0046c2f |
| MS4 | `/api/user/me` + admin consolidation | A | ✅ 2026-07-15 | f9bb4f5 |
| MS5 | Account deletion | A | ✅ 2026-07-15 | (this commit) |
| MS6 | Push-token registry | A | ✅ 2026-07-15 | (this commit) |
| PS1 🗎 | MOBILE_DESIGN_SPEC.md (→ registers `DS*`) | B | ✅ 2026-07-15 | f48f4d4 |
| DS1 | Design foundations (tokens, fonts, Skeleton, haptics) | B | ✅ 2026-07-15 | (this commit) |
| MS7 | Expo scaffold (incl. DS1) | B | ✅ 2026-07-15 | (this commit) |
| DS2 | Form & feedback primitives | B | ✅ 2026-07-15 | (this commit) |
| DS3 | Layout primitives | B | ✅ 2026-07-15 | (this commit) |
| DS4 | Domain components | B | ✅ 2026-07-15 | (this commit) |
| MS8 | Component library = DS2+DS3+DS4 complete | B | ✅ 2026-07-15 | (this commit) |
| DS5 | Auth & onboarding visual pass | C | ☐ | |
| DS6 | Core screens visual pass | D | ☐ | |
| DS7 | Predictions & account visual pass | D | ☐ | |
| DS8 | App icon + splash | F | ☐ | |
| DS9 | Motion, haptics & a11y audit | F | ☐ | |
| MS9 | Auth client + login | C | ✅ 2026-07-15 | (this commit) |
| MS10 | Signup + OTP verify | C | ✅ 2026-07-15 | (this commit) |
| MS11 | Team-select gate | C | ✅ 2026-07-15 | (this commit) |
| MS12 | Leagues home | D | ✅ 2026-07-15 | (this commit) |
| MS13 | League detail: fixtures + table | D | ✅ 2026-07-15 | (this commit) |
| MS14 | Join + admin surfaces | D | ✅ 2026-07-15 | (this commit) |
| MS15 | Predictions entry | D | ✅ 2026-07-15 | (this commit) |
| MS16 | Account screen | D | ✅ 2026-07-15 | (this commit) |
| PS2 🗎 | PUSH_SPEC.md (→ registers `NS*`) | E | ✅ 2026-07-15 | (this commit) |
| NS1 | Push infra + prefs | E | ✅ 2026-07-15 | (this commit) |
| NS2 | Deadline reminder cron | E | ✅ 2026-07-15 | (this commit) |
| NS3 | Results + GW-complete triggers | E | ✅ 2026-07-15 | (this commit) |
| NS4 | Client register + tap-routing | E | ✅ 2026-07-16 | (this commit) |
| NS5 | Preference toggles | E | ✅ 2026-07-16 | (this commit) |
| NS6 | On-device delivery pass 🍎 | E | ✅ 2026-07-16 | (this commit) |
| PS3 🗎 | STORE_LISTING.md (→ registers `LS*`) | F | ☐ | |
| *LS\** | *— defined by PS3 —* | F | — | |
| MS17 | TestFlight | F | ☐ | |
| MS18 | Beta hardening (`MS18.x` ad hoc) | F | ☐ | |
| MS19 | App Store submission → **live** | F | ☐ | |
| PS4 🗎 | Decommission check (→ confirms/re-cuts `XS*`) | G | ☐ | |
| XS1 | Static landing page | G | ☐ | |
| XS2 | Delete `frontend/` | G | ☐ | |
| XS3 | Backend web-era cleanup | G | ☐ | |

**Parallelism notes:** PS1 can run before/alongside all of Stage A. MS4/MS5/MS6 are order-flexible within Stage A. PS3 can overlap Stage E. Everything else: top to bottom.
