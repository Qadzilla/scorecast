# ScoreCast Mobile — Slice Roadmap

**Status:** Stages A + B COMPLETE; **Stage C underway — MS9 (login+gate) + MS10 (signup+OTP) shipped** (2026-07-15). Next: **MS11 (team-select gate)**; DS5 visual pass closes Stage C.
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

### MS11 — Team-select gate  *(§5.4 team-select)*
Onboarding gate for `favoriteTeamId == null`: crest grid, preview, Continue.
**Depends on:** MS9 (MS10 not strictly required).
**Exit:** fresh verified account is forced through team selection exactly once; choice persists server-side; existing users skip it.

**Stage C gate:** signup → verify → team → tabs and login/logout loops work end-to-end against the local backend.

---

## Stage D — Core product

### MS12 — Leagues home  *(§5.4 home)*
`(tabs)/index`: PL + UCL countdown cards (focus-aware 1s tick), league cards with rank/points, empty state → join CTA, pull-to-refresh, greeting header with crest.
**Depends on:** MS11, MS4 (uses `/me`).
**Exit:** account in ≥1 real league sees live countdowns and correct standing; account with none sees the empty state; pull-to-refresh visibly refetches.

### MS13 — League detail: Fixtures + Table  *(§5.4 league detail)*
`league/[id]` with segmented control; Fixtures pane (matches grouped by day, kickoff/FT states, red-card indicators); Table pane (full standings, own row highlighted, champion state when `isSeasonComplete`); league-info sheet with invite code + `expo-clipboard` copy.
**Depends on:** MS12.
**Exit:** matches real web-app data for the same league side by side; copy button yields a joinable code.

### MS14 — Join + admin surfaces  *(§5.4 join/create/members)*
`league/join` modal (8-char code entry); admin-gated `league/create` and `league/[id]/members` (rename, kick with `Alert.alert` confirm) driven by `isAdmin` from `/me` — no client-side email constants.
**Depends on:** MS13, MS4.
**Exit:** non-admin account joins a league by code and sees no admin UI anywhere; admin account creates a league, renames it, kicks a member.

### MS15 — Predictions entry  *(§5.4 predict)*
Predictions pane in league detail + `league/[id]/predict` flow: grouped score inputs with auto-advance, locked/finished/points states, sticky submit bar with entered-count, haptic on success, deadline-passed 400 handled gracefully.
**Depends on:** MS13.
**Exit:** predictions submitted from the app appear in the web app (and vice versa); after a scored match, points badges match the web's for the same user; a past-deadline submit shows the designed error, not a crash.

### MS16 — Account screen  *(§5.4 account, §4.3)*
Profile header + stat tiles, username edit (409 handling, Query invalidation instead of reload), favorite-team change, account info, sign out, **Delete Account** end-to-end (destructive confirm → MS5 endpoint → local sign-out). Notification-preference toggles get placeholder UI only (real storage lands with `NS*`).
**Depends on:** MS11, MS5.
**Exit:** username rename reflects everywhere without relaunch; delete-account on a throwaway user signs out, blocks re-login, and leaves no orphan rows (re-run MS5's verification query).

**Stage D gate: feature parity with the web app** (minus demo mode, by decision §0). Everything before P6 ran on the simulator; from here on a physical iPhone and the Apple Developer account are required — **enroll now if not already done ($99, verification can take days)**.

---

## Stage E — Push (the one net-new feature)

### PS2 — Write `PUSH_SPEC.md` 🗎  *(§7, §10)*
**Planning slice.** Finalize the §7 contract: exact copy for all four notification types, the dedup/batching rules and whether that's a `push_log` table or `remindedAt` markers (schema decision), preference storage (columns on `push_token` vs `notification_pref` table), token-pruning cadence, quiet-hours call (§7 leans "none in V1" — confirm or overturn). **Must end in an `NS*` slice table** — expected shape: sender service + receipts → reminder cron + dedup schema → results/GW-complete triggers → client permission + registration + tap-routing → preference toggles (replacing MS16's placeholders) → on-device verification pass. Register `NS*` into the tracker.
**Depends on:** Stage D gate (push prompts are contextual on first prediction — the flow it hooks into must exist).
**Exit:** `PUSH_SPEC.md` exists, resolves every open decision in §7, ends in an `NS*` slice table, tracker updated.

### NS1…NSn — Push execution  *(defined by PS2)*
Placeholder — replaced by PS2's table. Hard exit criterion for the series as a whole (inherited from §11 P6): **all four notification types received on a physical iPhone from real cron runs** (windows shrunk locally for testing), preferences honored, opt-out verified.
**Depends on:** PS2, MS6, Apple Developer account, EAS dev build on device.

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
| MS11 | Team-select gate | C | ☐ | |
| MS12 | Leagues home | D | ☐ | |
| MS13 | League detail: fixtures + table | D | ☐ | |
| MS14 | Join + admin surfaces | D | ☐ | |
| MS15 | Predictions entry | D | ☐ | |
| MS16 | Account screen | D | ☐ | |
| PS2 🗎 | PUSH_SPEC.md (→ registers `NS*`) | E | ☐ | |
| *NS\** | *— defined by PS2 —* | E | — | |
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
