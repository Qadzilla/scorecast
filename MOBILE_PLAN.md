# ScoreCast Mobile — Web → iOS App Conversion Plan

**Status:** Planning complete, execution not started.
**This document is the single source of truth** for converting ScoreCast from a web app (React + Vite, live at scorecast.club) into a native iOS app (Expo React Native). Every technical and design decision is either recorded here or delegated to a named follow-up document (see §10).

---

## 0. Decisions locked (2026-07-15)

| Decision | Choice | Rationale |
|---|---|---|
| Mobile approach | **Expo React Native** (SDK 54, RN 0.81, React 19) | True native UX, push notifications, App Store presence. Same stack as MalaaBi so the workflow (Expo Router, EAS builds, dev client) is already known. |
| Web app fate | **Deleted completely** | scorecast.club stops being an app. See §8 for decommission order — web stays alive until the iOS app is approved, and one static page must survive (privacy policy, §9.3). |
| Scope | **Feature parity + push notifications** | Push (deadline reminders, results) is the single biggest win of being on the phone for a predictions game. No other new features in this pass. |
| Platform | **iOS first** | Development happens on Mac + iPhone. Android is deferred, not descoped — Expo gives it nearly free later; nothing in this plan may block it. |
| Visual direction | **Unified light theme** | The web dashboard's light look (slate gradient, white cards, PL purple / UCL navy accents) becomes the whole app. Auth screens are redesigned from dark glassmorphism to match. See §6. |
| Email verification | **6-digit OTP code** (better-auth `emailOTP` plugin) | The current flow emails a link that redirects to the website — which won't exist. A typed code has zero web dependency and standard mobile UX. |
| Demo mode | **Dropped** | Not ported. App Store review gets a dedicated test account instead (§9.4). The public (no-auth) fixtures endpoints it used stay, they're harmless. |
| Repo layout | **Same repo.** New `mobile/` workspace next to `backend/`. `frontend/` is deleted at decommission (§8), not before. | One backend, one history, one place to look. |

---

## 1. Current state (what exists today)

**Frontend** (`frontend/`): React 19 + Vite + Tailwind v4. No router — `App.tsx` switches views off auth state. Seven components; `Dashboard.tsx` is a 2,103-line monolith containing five distinct screens (leagues home, create league, join league, league detail, account). Auth via `better-auth/react` with **cookie sessions** (`credentials: "include"` everywhere). Deployed on Vercel.

**Backend** (`backend/`): Express 5 + Postgres (`pg`), better-auth (email/password, email verification via Resend link), routes: `fixtures`, `predictions`, `leagues`, `leaderboard`, `user`, `admin`. football-data.org sync on node-cron (full sync every 6h, results every 15min). Deployed on Railway (Dockerfile), DB on Neon.

**The backend survives almost untouched.** It is already a clean JSON API. The work splits into:
- a small set of **backend changes** (§4) — auth transport, OTP, account deletion, push, hygiene;
- a **full frontend rewrite** in React Native (§5);
- a **design translation** to a unified light system (§6);
- **push notifications**, the one net-new feature (§7);
- **decommission + store submission** (§8, §9).

---

## 2. Security check — ✅ resolved (2026-07-15, slice MS0)

An initial code inventory reported `backend/.env` (Resend key, `BETTER_AUTH_SECRET`, football-data key) as committed to git. **Verification proved this false**: `backend/.env` was never tracked (`git log --all -- backend/.env` is empty), the three live secret values have **zero occurrences across all of git history** (`git grep -F <value> $(git rev-list --all)`), and the tracked `.env.example` files contain placeholders only. This mattered — the GitHub repo (`Qadzilla/scorecast`) is **public**.

Outcome: **no rotation, no history purge needed.** MS0 instead: verified the above, deleted the stray SQLite dev artifacts (`data.db`, `sqlite.db`, `test-data.db` — untracked, Postgres-only codebase), and confirmed `.gitignore` covers every env/db pattern. Standing rule: secrets live only in untracked `.env` locally and Railway env vars in prod; anything new goes into `.env.example` as a placeholder.

---

## 3. Target architecture

```
┌─────────────────────────┐
│  ScoreCast iOS app       │  Expo SDK 54 / RN 0.81 / React 19 / TS strict
│  (mobile/, Expo Router)  │  better-auth Expo client (SecureStore sessions)
│                          │  TanStack Query (server state) + Zustand (UI state)
└───────────┬─────────────┘
            │ HTTPS (bearer/session via better-auth Expo transport)
            │ Expo push receipts
┌───────────▼─────────────┐
│  Express 5 API (Railway) │  unchanged routes + new: OTP verify, account
│  better-auth + expo()    │  deletion, push-token registry, /api/user/me
│  node-cron jobs          │  + new push senders (expo-server-sdk)
└───────────┬─────────────┘
            │
   Postgres (Neon)          football-data.org (sync, unchanged)
   + push_token table       Resend (OTP emails instead of link emails)
   Expo Push Service (new)  APNs (via Expo push, no direct APNs code)
```

What disappears: Vercel deployment, cookie-CORS gymnastics (`sameSite: "none"`), the `?verified=true` redirect handshake, `VITE_*` env vars, Tailwind, the demo mode.

---

## 4. Backend changes

Designed to be **additive and backward-compatible** until decommission: the web app keeps working on cookies + verification links while the mobile app is developed against the same server. Nothing here breaks the live site.

### 4.1 Auth transport — better-auth Expo support

The RN app cannot use browser cookie sessions. better-auth has first-party Expo support.

- **Server** (`backend/src/auth.ts`): add the `expo()` plugin from `@better-auth/expo`. Add the app scheme to `trustedOrigins`: `["scorecast://"]` alongside the existing web origins (web ones removed at decommission).
- **Client** (`mobile/src/lib/auth.ts`): `createAuthClient` from `better-auth/react` + `expoClient` plugin from `@better-auth/expo/client`, with `expo-secure-store` as storage. This gives the same `signIn`/`signUp`/`signOut`/`useSession` surface the web code uses — the auth calls in the RN screens are near copy-paste. The plugin stores the session cookie in SecureStore and replays it as a header; no manual token plumbing.
- **Keep** the custom `POST /api/auth/lookup-email` route (username-or-email login) exactly as is — the RN login screen uses it identically.
- The session `cookieCache` (5 min) and the `databaseHooks.user.create.before` sanitizer stay unchanged.

### 4.2 Email verification — link → OTP

- Add better-auth's `emailOTP` plugin configured for verification: `sendVerificationOTP({ email, otp })` → send via existing `sendEmail()` (Resend), reusing the branded HTML template but with a large 6-digit code instead of a button link. `requireEmailVerification: true` stays.
- Client flow: after `signUp.email(...)` succeeds → navigate to the Verify screen → user types the code → `emailOtp.verifyEmail({ email, otp })` → on success, sign the user in (`autoSignInAfterVerification` equivalent: just call `signIn.email` with the held credentials, or enable the plugin's sign-in-on-verify option).
- Add a "Resend code" action (the plugin exposes `sendVerificationOtp`) with a 60s client-side cooldown; server rate limiting already covers abuse (`authLimiter`).
- **During the transition** the old link flow keeps working for the web app (both can be enabled simultaneously). The link flow, the `callbackURL` rewrite in `auth.ts:69`, and the `?verified=true` convention are deleted at decommission (§8).

### 4.3 Account deletion (App Store blocker — Apple guideline 5.1.1(v))

Today: the web "Delete Account" button is a `TODO` no-op and **no backend endpoint exists**. Apple rejects apps with sign-up but no in-app account deletion. This is mandatory, not nice-to-have.

- ✅ (MS5) Custom `DELETE /api/user/account` under `requireAuth`, single `withTransaction`. Chosen over better-auth `deleteUser` for direct cascade control.
- ✅ (MS5) FK-cascade audit done in migration `007_user_delete_cascade` — **every** app FK to `user(id)` lacked an ON DELETE action (default NO ACTION, which blocked deletion):
  - `prediction`, `league_member`, `user_gameweek_score`, `user_league_standing` (userId) → CASCADE.
  - `league.createdBy` → SET NULL (leagues survive their creator; column made nullable).
  - `session`, `account` (userId) → CASCADE enforced defensively (db.ts creates them cascading, but a pre-cascade DB / the test fixture would block deletion).
  - `verification` — no user FK (email-keyed); the endpoint clears it explicitly.
  - `push_token` — created with CASCADE in migration `008` (§4.5).
- Client: destructive confirmation (type-to-confirm or double alert), then sign-out + return to auth stack. Note: better-auth `cookieCache` (5 min) means the stale cookie may still pass `requireAuth` briefly post-delete — the client signs out locally, so this is benign.

### 4.4 `GET /api/user/me` + admin flag

The web app gates the Create-League and league-admin UI on `VITE_ADMIN_EMAIL` — an env var **baked into the client bundle**. Don't replicate that in a shipped binary (it's both leaky and unchangeable without an app update).

- ✅ (MS4) `GET /api/user/me` (requireAuth): returns profile fields + `isAdmin` computed server-side.
- ✅ (MS4) Fixed the env split: `ADMIN_EMAIL` (singular, `routes/leagues.ts`) vs `ADMIN_EMAILS` (plural, `routes/admin.ts`). Consolidated onto `ADMIN_EMAILS` via `src/lib/admin.ts` (`isAdmin` + `requireAdmin`), `ADMIN_EMAIL` kept as a one-deploy deprecation fallback, now case-insensitive (leagues.ts was case-sensitive — a latent lockout bug).

### 4.5 Push notification infrastructure

See §7 for the product spec. Backend pieces:

- ✅ (MS6) **Migration `008_push_tokens`** (renumbered from the plan's tentative `007`, which became the cascade migration): `push_token (id, "userId" → user ON DELETE CASCADE, token UNIQUE, platform CHECK('ios','android'), "createdAt", "updatedAt")` + index on userId. One user may have several devices.
- ✅ (MS6) **Routes** (requireAuth): `POST /api/push/register {token, platform}` (upsert on token — Expo tokens rotate/move between devices), `DELETE /api/push/register {token}` (scoped to caller, on logout / opt-out). `pruneToken`/`tokensForUser` helpers exported for the sender.
- **Sender service** (`backend/src/services/push.ts`): `expo-server-sdk` — chunked sends, receipt checking, and pruning of tokens Expo reports as `DeviceNotRegistered`. *(Deferred to NS\* per §7 — schema + registry only in MS6.)*
- **Triggers wired into existing jobs** (no new cron schedules needed except reminders):
  1. *Deadline reminder*: new cron every 30 min — find gameweeks with `deadline` between now+23.5h/now+24h and now+0.5h/now+1h (two reminder windows: ~24h and ~1h before); notify members of leagues of that competition **who have not yet submitted predictions** for that gameweek. Dedup via a `push_log` table or a `remindedAt` marker — decide in PUSH_SPEC.md (§10).
  2. *Results/points*: at the end of `scorePredictionsForMatch(...)` batches inside the existing 15-min results cron — after a match is scored, notify users who predicted it: "FT: ARS 2–1 CHE — you scored 3 pts".
  3. *Gameweek complete*: when the results cron detects `isGameweekComplete` flipped true — send rank summary per league ("GW21 done — you're 2nd in Kickoff Kings").
- All sends are **best-effort and non-blocking** (fire-and-forget after the DB work commits; a push failure must never fail a sync job).

### 4.6 Hygiene (small, do in Phase 1 while touching the code)

- ✅ **Rate limiting** (MS1): the global limiter was 100 req/15 min **per IP**, and mobile carriers put thousands of users behind shared CGNAT IPs. Raised general to 1000/15min and auth to 300/15min (the auth limiter covers all of `/api/auth/*` including frequent `get-session`); both env-overridable via `RATE_LIMIT_GENERAL_MAX` / `RATE_LIMIT_AUTH_MAX`.
- ✅ `GET /health` (MS1) — registered before the limiters so probes are never throttled.
- ✅ `middleware/sanitize.ts` (MS1) — deleted; it was never mounted and the better-auth `user.create.before` hook already sanitizes.
- ✅ Stray SQLite artifacts deleted (MS0).
- `EMAIL_FROM` fallback hardcodes `noreply@scorecast.club` — fine (the domain stays for email + privacy page), just ensure the Railway var is set explicitly.
- ✅ Found during MS1, fixed in MS3: the vitest suite sent **real Resend emails** on signup — `sendEmail` now captures to an in-memory `testOutbox` under `NODE_ENV === "test"`.

### 4.7 Explicitly unchanged

Fixtures/predictions/leaderboard/leagues route logic, deadline enforcement, scoring (`POINTS`: exact 3 / result 1 / miss 0), the football-data sync service and its UCL stage handling, invite-code league joining (8-char codes typed in-app — conveniently this never depended on web links), Resend as email provider, Railway + Neon hosting, all backend tests.

---

## 5. Mobile app (`mobile/`)

### 5.1 Stack & dependencies

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Expo SDK 57, RN 0.86, React 19.2, TypeScript strict** (updated in MS7 from the originally-planned SDK 54 — latest-stable is right for a new app and satisfies better-auth's Expo peers) | No `any` without a justifying comment. Routes live under `src/app/`. |
| Navigation | **Expo Router** (file-based, `mobile/app/`) | Route groups: `(auth)` stack + `(tabs)`. |
| Server state | **TanStack Query** | Hook layer in `src/lib/queries/` — components never call `fetch`/the API client directly (same convention as MalaaBi). |
| UI state | **Zustand** (sparingly) | Never caches server data. Likely only needed for transient prediction-entry drafts. |
| Auth | `better-auth` + `@better-auth/expo/client` + `expo-secure-store` | §4.1. |
| Forms | **React Hook Form + Zod** | Auth forms, username edit. Port `lib/validation.ts` limits into Zod schemas. |
| Styling | **`StyleSheet` + design tokens file** (`src/constants/theme.ts`) | *Not* NativeWind. The Tailwind classes die with the web app anyway, the light theme is a redesign not a translation, and the token-file pattern is proven from MalaaBi. Fewer build-chain deps. |
| Images | **expo-image** | Team crests come from `crests.football-data.org` and are frequently **SVG** — expo-image renders SVG natively; if a crest misbehaves, fall back to `react-native-svg`'s `SvgUri` for that surface. Cache policy `memory-disk`. |
| Fonts | `@expo-google-fonts/plus-jakarta-sans` + `expo-font` | Keeps the brand font (Regular/Medium/SemiBold/Bold/ExtraBold). |
| Gradients | `expo-linear-gradient` | Background washes, brand accents. |
| Push | `expo-notifications` | §7. |
| Haptics | `expo-haptics` | Score entry, submit success. |
| Safe areas | `react-native-safe-area-context` | Every screen wrapped. |
| Dev workflow | **EAS dev client** (not Expo Go) | Push notifications require a dev build. `npx expo start` for Metro; `eas build --profile development --platform ios` when native deps change. |

No maps, no location, no Stripe — this app is far lighter than MalaaBi native-wise.

### 5.2 Project structure

```
mobile/
  app/                        # Expo Router routes (the screens)
    _layout.tsx               # root: fonts, QueryClientProvider, auth gate, theme
    (auth)/
      _layout.tsx             # stack, light bg
      login.tsx
      signup.tsx
      verify.tsx              # 6-digit OTP entry (+ resend w/ cooldown)
      team-select.tsx         # favorite-team onboarding gate
    (tabs)/
      _layout.tsx             # tab bar: Leagues / Account (2 tabs, see 5.3)
      index.tsx               # Leagues home (countdowns + league list)
      account.tsx
    league/
      [id].tsx                # league detail (fixtures / my predictions / table)
      [id]/predict.tsx        # prediction entry for current gameweek
      join.tsx                # invite-code entry (modal presentation)
      create.tsx              # admin-only (gated by /api/user/me isAdmin)
      [id]/members.tsx        # admin-only member management
  src/
    components/               # Button, Card, ScreenHeader, CountdownCard,
                              # PointsBadge, TeamCrest, ScoreInput, MatchRow,
                              # LeaderboardRow, EmptyState, RulesSheet, ...
    constants/theme.ts        # design tokens (§6)
    lib/api.ts                # typed fetch wrapper (port of frontend/src/lib/api.ts)
    lib/auth.ts               # better-auth Expo client
    lib/queries/              # TanStack Query hooks: fixtures.ts, predictions.ts,
                              #   leagues.ts, leaderboard.ts, user.ts, push.ts, index.ts
    lib/notifications.ts      # permission flow + token registration
    types/                    # port frontend/src/types (fixtures, predictions)
    utils/                    # getTimeRemaining, calculatePredictionPoints,
                              #   formatRank, date grouping — port verbatim
  app.json / eas.json
```

Bundle identifier: **`club.scorecast.app`**. Scheme: **`scorecast`**. API base URL via `EXPO_PUBLIC_API_URL` (dev: LAN IP of local backend; prod: Railway URL).

### 5.3 Navigation map (web → mobile)

The web app's state-based views map onto real navigation. **Two tabs, not five** — leagues *are* the app; account is the only other top-level destination. Everything else is pushed or modal.

| Web (state view in App/Dashboard) | Mobile route | Change |
|---|---|---|
| `login` / `signup` / `verify-email` views | `(auth)/login`, `signup`, `verify` | Verify becomes an OTP input screen instead of a static "check your email" notice. |
| TeamSelector gate | `(auth)/team-select` | Same gate: session exists but no `favoriteTeamId` → forced here before tabs. |
| Dashboard `leagues` view | `(tabs)/index` | Countdown cards + league list, pull-to-refresh. |
| Dashboard `league-detail` view | `league/[id]` | Pushed screen. The web 3-column layout becomes a segmented control: **Fixtures / Predictions / Table** (§5.4). |
| Predictions form (inline) | `league/[id]/predict` | Own full-screen flow with sticky submit. |
| Dashboard `join` view | `league/join` (modal) | Invite-code entry, auto-uppercase, 8-char. |
| Dashboard `create` view (admin) | `league/create` (modal, admin-only) | Gated by `isAdmin` from `/api/user/me`, not an env var. |
| Dashboard admin panel (rename/kick) | `league/[id]/members` (admin-only) | Kick confirm via `Alert.alert` (replaces `window.confirm`). |
| Dashboard `account` view | `(tabs)/account` | Plus a **working** Delete Account flow (§4.3) and notification preferences (§7.3). |
| Rules modal | Bottom sheet / modal from league detail & home | Content ports verbatim. |
| Demo mode | — | Dropped. |

Deep linking: **not needed in V1.** Verification is OTP (no links), league invites are typed codes (no links), so no universal-links / AASA hosting requirement. The `scorecast://` scheme exists only for better-auth's Expo transport.

### 5.4 Screen-by-screen breakdown

Every screen must handle: loading (skeleton or spinner), error (retry affordance), empty state, and offline failure (Query's `onError` → toast). All screens in `SafeAreaView`.

**`(auth)/login`** — port of `LoginForm.tsx`. Identifier (username-or-email) + password. Same two-step call: `POST /api/auth/lookup-email` → `signIn.email`. Same error mapping (429 → "wait 15 minutes", else generic invalid-credentials). Drop: the left branding panel (mobile is single-column; brand lives in a compact header lockup), the Try-Demo pill. `KeyboardAvoidingView`; submit on keyboard return.

**`(auth)/signup`** — port of `SignUpForm.tsx`. firstName/lastName/username/email/password/confirm, Zod schemas from `lib/validation.ts` limits (email 254, name 50, password 8–128, username 3–30). Username lowercased before submit. "Account exists" → inline link to login. On success → `verify` with email param (and hold credentials in memory for post-verify sign-in).

**`(auth)/verify`** — new screen (replaces the static VerifyEmail notice). Six single-digit boxes, auto-advance, paste support, `textContentType="oneTimeCode"` so iOS offers the code from Mail. Resend with 60s cooldown. On success → sign in → team gate or tabs.

**`(auth)/team-select`** — port of `TeamSelector.tsx`. `GET /api/user/teams`, crest grid (3-col on phones), selected-team preview, Continue → `POST /api/user/favorite-team`. `FlatList` with `numColumns`, crests via `TeamCrest` (expo-image).

**`(tabs)/index` — Leagues home** — port of Dashboard `leagues` view. PL + UCL `CountdownCard`s (1s tick, from `getTimeRemaining`; **pause the interval when the screen is unfocused** — use `useFocusEffect`), then league cards (name, type badge, member count, your rank + points). Empty state → Join CTA. Header: greeting + favorite-team crest. Pull-to-refresh invalidates leagues + gameweek queries.

**`league/[id]` — League detail** — the web 3-column desktop layout can't stack meaningfully on a phone; segmented control with three panes:
- *Fixtures*: current gameweek matches grouped by day (`MatchRow`: crests, kickoff time or FT score, red-card indicators). Data: `GET /api/fixtures/gameweek/current/:competition` + `GET /api/fixtures/gameweek/:id`.
- *Predictions*: user's predictions with `PointsBadge` per settled match; prominent "Make/Edit Predictions" button while deadline is open → `predict`. Deadline countdown pinned at top.
- *Table*: full standings from `GET /api/leaderboard/:leagueId` (web showed top-5 + link; phone shows the full `FlatList`, own row highlighted, champion treatment when `isSeasonComplete`).
League Info (invite code + copy button via `expo-clipboard`, member count) in a header card or sheet. Admin (rename, members) behind a toolbar button when `isAdmin`.

**`league/[id]/predict`** — port of `Predictions.tsx`. Matches grouped by date; per-match two `ScoreInput`s (single digit, `inputMode` numeric, auto-advance home→away→next match, regex `^\d$` gate — the 0–9 UI constraint vs the server's 0–99 validation stays as-is). Locked/finished states identical to web (lock display after deadline; score + points badge when finished). Sticky bottom submit bar with count ("7/10 entered"); haptic on submit success. `POST /api/predictions/:leagueId/gameweek/:gameweekId`. Server re-checks the deadline — surface its 400 as "Deadline has passed" and refresh.

**`(tabs)/account`** — port of Dashboard `account` view: profile header (avatar initial or crest, name, stat tiles), username edit (RHF+Zod, 409 → "taken"; **replace the web's `window.location.reload()` after rename with a Query invalidation of the session/me queries**), favorite-team change (reuses team grid), account info (first/last/email/verified), notification preferences (§7.3), sign out, and **Delete Account** (destructive confirm → `DELETE` → local sign-out).

**`league/join` / `league/create` / `league/[id]/members`** — thin ports of the corresponding Dashboard sections; nothing novel beyond `Alert.alert` confirms and modal presentation.

### 5.5 Data layer

Port `frontend/src/lib/api.ts` (typed `apiFetch` + `fixturesApi` / `predictionsApi` / `leaderboardApi` / `leaguesAdminApi`) essentially verbatim, minus `credentials:"include"` (the better-auth Expo client injects auth). Wrap every endpoint in a TanStack Query hook in `src/lib/queries/`:

- Query keys: `['me']`, `['teams']`, `['leagues']`, `['gameweek', competition]`, `['gameweek', id]`, `['predictions', leagueId, gameweekId]`, `['leaderboard', leagueId]`.
- Mutations invalidate precisely: submit predictions → `['predictions', ...]`; join league → `['leagues']`; username → `['me']`; favorite team → `['me']`.
- `staleTime`: fixtures/gameweek 5 min (results cron runs every 15), leaderboard 1 min, teams 24 h, me/leagues 1 min. `refetchOnWindowFocus` → RN AppState-based refetch (Query supports this via `focusManager`).

Port `frontend/src/types/*` and the pure helpers (`getTimeRemaining`, `calculatePredictionPoints`, `getPointsBadgeColor`, `formatRank`, `POINTS`) verbatim — they're platform-independent. Hermes on RN 0.81 ships full `Intl`, so the `toLocaleDateString`/`toLocaleTimeString` date grouping works unchanged.

### 5.6 Browser-API replacement table

| Web usage | Mobile replacement |
|---|---|
| `window.location.search` + `?verified=true` handshake (`App.tsx`) | Gone entirely — OTP flow has no redirect. |
| `window.history.replaceState` | Gone. |
| `window.location.reload()` after username change (`Dashboard.tsx:707`) | Invalidate `['me']` + better-auth session refetch. |
| `confirm()` for member kick (`Dashboard.tsx:640`) | `Alert.alert` with destructive action. |
| `localStorage` (better-auth web client internals) | `expo-secure-store` via the Expo client plugin. |
| Tailwind classes / `backdrop-blur` / CSS gradients | `StyleSheet` + tokens; `expo-linear-gradient`; no blur needed in the light design (§6). |
| `<img>` remote crests | `expo-image` (`TeamCrest` component, SVG-capable). |
| `setInterval` countdowns | Same, but lifecycle-aware (`useFocusEffect` cleanup). |
| `import.meta.env.VITE_*` | `process.env.EXPO_PUBLIC_*`. |

---

## 6. Design system — unified light

**Decision:** one light theme app-wide. The web dashboard's light look is the starting point; the dark-glassmorphism auth screens are **redesigned**, not translated. The full screen-by-screen visual spec is a follow-up doc (§10, `MOBILE_DESIGN_SPEC.md`); this section fixes the system.

### 6.1 Tokens (`src/constants/theme.ts`)

```
colors
  bg            #f1f5f9   (slate-100 — flat; the web's subtle 3-stop gradient
                           becomes a flat wash, optionally one LinearGradient
                           on the home header only)
  surface       #ffffff   (cards; the web's translucent white → solid white
                           + shadow — translucency over a flat bg is pointless)
  surfaceAlt    #f8fafc   (inset rows, inputs)
  border        #e2e8f0
  textPrimary   #0f172a
  textSecondary #64748b
  textOnBrand   #ffffff
  plPurple      #3d195b   (+ plPurpleLight #6b2d8a)   — PL league accents
  uclNavy       #04065c   (+ uclNavyLight #1a237e)    — UCL league accents
  accent        #00b368   — actions/success. NOTE: the web's neon #00ff87 was
                           designed for dark backgrounds and fails WCAG
                           contrast on white; darkened for light theme.
                           Neon #00ff87 survives only as a decorative accent
                           on brand-purple surfaces, never as text/CTA fill.
  danger        #dc2626
  warning       #d97706   (deadline < 24h states)
type
  Plus Jakarta Sans: Regular 400 / Medium 500 / SemiBold 600 / Bold 700 / ExtraBold 800
  scale: display 28/34 · title 22/28 · heading 17/24 · body 15/22 ·
         caption 13/18 · mono-ish score digits: Bold, tabular via
         fontVariant: ['tabular-nums'] (countdowns must not jitter)
spacing   4 / 8 / 12 / 16 / 20 / 24 / 32        radius  10 / 14 / 20 / pill
shadow    one soft card shadow (iOS shadowOpacity ~0.06, radius 12) — no blur
```

### 6.2 Design rules

- **League-type theming stays**: PL surfaces use `plPurple`, UCL uses `uclNavy` — headers, segmented-control active state, countdown card tint, points badges. This is the app's strongest existing visual idea; keep it.
- **Auth redesign**: white/`bg` screens, brand lockup ("ScoreCast" in ExtraBold with a purple→navy gradient text or mark), solid white input cards. The purple→navy identity moves from *background* to *accents*.
- **Points badges** keep semantics: exact (3) = filled accent-green, correct result (1) = neutral/outline, miss (0) = muted red-tinted. `getPointsBadgeColor` gets re-mapped to light-theme values.
- **Countdown cards**: white card, competition-tinted left rail + label, tabular-nums digits; `warning` tint under 24h, `danger` under 1h.
- Dark mode: **out of scope for V1** (declare light-only; RN handles this fine). Tokens are structured so a dark map can be added later without touching components.
- Accessibility: minimum touch target 44pt; all text ≥ 4.5:1 contrast on its surface (this is what killed neon-green-on-white); crests get `accessibilityLabel` of team name.

### 6.3 Core components to build (once, in Phase 2)

`Button` (primary/secondary/destructive/loading) · `Card` · `ScreenHeader` · `TextField` (RHF-wired) · `SegmentedControl` · `CountdownCard` · `MatchRow` · `ScoreInput` · `PointsBadge` · `TeamCrest` · `LeaderboardRow` · `EmptyState` · `Sheet` (rules, league info) · `StatTile` (account) · `Banner` (errors/offline).

---

## 7. Push notifications (product spec summary)

Full spec → `PUSH_SPEC.md` (§10). The contract:

### 7.1 Notification types (V1)

| # | Trigger | Copy sketch | Audience |
|---|---|---|---|
| 1 | 24h before gameweek deadline | "GW22 locks tomorrow 19:30 — 10 matches to predict" | League members **without submitted predictions** for that gameweek |
| 2 | 1h before deadline | "⏰ 1 hour left to lock in GW22 predictions" | Same, still-unsubmitted only |
| 3 | Match scored (results cron) | "FT: Arsenal 2–1 Chelsea — you scored 3 pts" | Users with a prediction on that match |
| 4 | Gameweek complete | "GW22 done: 14 pts — up to 2nd in Kickoff Kings" | All league members |

Type 3 batching rule: multiple matches finishing in the same 15-min cron tick collapse into one notification per user ("3 results in: +5 pts").

### 7.2 Client mechanics

Permission prompt is **contextual, not on launch**: ask after the user's first prediction submission ("Want a reminder before deadlines?" pre-prompt → OS prompt). `expo-notifications` → `getExpoPushTokenAsync` → `POST /api/push/register`. Re-register on app start if permission granted (tokens rotate). Unregister on sign-out. Tapping a notification routes to the relevant league (`league/[id]`) — in-app routing from the notification payload, still no external deep links.

### 7.3 Preferences

Account screen toggles: *Deadline reminders* / *Results & points* / *League updates* — stored server-side (columns on `push_token` or a `notification_pref` table; decide in PUSH_SPEC.md). Default all-on at registration.

### 7.4 Constraints

Requires the paid Apple Developer account (APNs) and a **physical device + EAS dev build** (no simulator, no Expo Go). Expo Push Service handles APNs; no direct APNs code. This is why push is a late phase (P6) — everything before it works in the simulator.

---

## 8. Web decommission (LAST — after App Store approval)

Order matters: the website keeps working through the entire build and beta. Kill it only when the app is live.

1. App approved and live on the App Store ✅ (gate for everything below)
2. Replace scorecast.club with a single static page: app name, App Store badge/link, **privacy policy**, support email (§9.3). Vercel can host this same static page — keep it, it's free.
3. Delete `frontend/` from the repo. Port nothing further from it (this plan already extracted everything).
4. Backend cleanup commit:
   - remove web origins from `CORS_ORIGIN` / `trustedOrigins` (native requests send no Origin header and pass the existing allow-no-origin branch)
   - delete the email **link**-verification flow + `callbackURL` rewrite (`auth.ts:61-109` link parts); OTP remains the only path
   - drop cookie `sameSite:"none"` cross-origin config (no more browser cross-site context)
   - remove `VITE_*` references from docs
5. Update `README.md` (kill "Live at scorecast.club" web framing, new architecture diagram).
6. Keep: Railway backend, Neon DB, Resend (now sending OTP emails), the scorecast.club domain (email sender + privacy page).

---

## 9. App Store submission checklist

1. **Apple Developer Program** ($99/yr) — needed before push (P6) and TestFlight (P7). Enroll early; verification can take days.
2. **EAS**: `eas.json` with `development` / `preview` / `production` profiles; bundle id `club.scorecast.app`; `eas build --platform ios` + `eas submit`. App icon (1024pt master) + splash — new assets needed, the web app has no app icon (follow-up: `STORE_LISTING.md`, §10).
3. **Privacy policy URL** — required field in App Store Connect. Even with the website "deleted," one static page must exist (§8.2). Covers: account data (name/email/username), predictions, push tokens, no ads/tracking. Also fill Apple's privacy-nutrition-label questionnaire (data linked to identity: email, name, user ID).
4. **Review notes + test account** — since demo mode is dropped, provide a pre-verified test account (create it directly in the DB or via a seeded script) with membership in a populated league so the reviewer sees real content.
5. **Account deletion** visible in-app (§4.3) — reviewers check this.
6. **Sign in with Apple: not required** — it's only mandated when third-party/social login is offered; ScoreCast is email/password only.
7. Age rating questionnaire (4+; no gambling mechanics — predictions have no stakes; say so in review notes since "sports predictions" can pattern-match to gambling. If flagged, the response is: no money in, no money out, no prizes).
8. Support URL/email (the static page + `support@scorecast.club` or personal email).

---

## 10. Follow-up documents to write (planned plans)

| Doc | Written when | Contents |
|---|---|---|
| `MOBILE_DESIGN_SPEC.md` | Start of Phase 2 | Screen-by-screen visual spec on the §6 tokens: exact layouts, component states (loading/empty/error/locked/finished), the auth-screen redesign, app icon direction. |
| `PUSH_SPEC.md` | Start of Phase 6 | Final copy for all 4 notification types, dedup/batching rules + `push_log` schema decision, preference storage, quiet-hours policy (probably none in V1), token-pruning cadence. |
| `STORE_LISTING.md` | Phase 7 | App name ("ScoreCast — Football Predictions"), subtitle, keywords, description, screenshot plan (6.7" + 6.1" sets), icon + splash final assets, review notes text. |
| `DECOMMISSION_RUNBOOK.md` | Only if §8 turns out to need more than its checklist | Otherwise §8 *is* the runbook. |

## 11. Execution phases

Each phase ends runnable and committed. iOS simulator suffices through P5; P6+ needs a device.

- **P0 — Security & hygiene (backend)**: ✅ security check resolved — secrets verified never-committed, SQLite artifacts deleted (§2, slice MS0). Remaining: `GET /health`; rate-limit fix (§4.6). *Exit: hygiene items live in prod, web app still works.*
- **P1 — Backend mobile enablement**: `expo()` plugin + `scorecast://` trusted origin; `emailOTP` plugin (link flow still on in parallel); `GET /api/user/me` with `isAdmin`; `ADMIN_EMAILS` consolidation; account-deletion endpoint + FK-cascade audit/migration; migration `007_push_tokens` + register/unregister routes (senders come in P6). Backend tests for OTP, deletion, `/me`. *Exit: all new endpoints tested via curl/vitest; web unaffected.*
- **P2 — App scaffold + design system**: `mobile/` Expo app, TS strict, Expo Router skeleton, fonts, `theme.ts` tokens, core components (§6.3) in a dev gallery screen; API client + Query provider wired to local backend. *Exit: gallery screen renders every component; hits `/health` from the simulator.*
- **P3 — Auth + onboarding**: login (incl. lookup-email + 429 mapping), signup, OTP verify (+resend), team-select, auth gating in root layout, SecureStore session persistence across relaunch. *Exit: full signup→verify→team→tabs and login/logout loops on simulator against local backend.*
- **P4 — Core screens**: Leagues home (countdowns, league cards, pull-to-refresh), league detail (Fixtures/Predictions/Table panes), leaderboard, join-league modal; admin create/rename/kick screens gated by `/me`. *Exit: a real user in a real league sees live fixtures, standings, and their predictions.*
- **P5 — Predictions + account**: prediction entry flow (inputs, deadline lock, submit, points display), account screen (username edit, team change, sign out, **delete account** end-to-end), rules sheet. *Exit: feature parity with the web app (minus demo mode); deadline enforcement verified with a near-deadline gameweek.*
- **P6 — Push**: backend senders + cron triggers (§4.5, §7 — write `PUSH_SPEC.md` first), client permission flow + registration + tap-routing, preference toggles. Requires Apple dev account + physical iPhone + EAS dev build. *Exit: all 4 notification types received on-device from real cron runs (test by shrinking windows locally).*
- **P7 — TestFlight beta**: production EAS build, icon/splash, `STORE_LISTING.md` assets, internal TestFlight, invite the real league group, fix the fallout, error tracking (Sentry `sentry-expo` — decide during phase). *Exit: a stranger can install from TestFlight and complete signup→predict→get a result push.*
- **P8 — Submit + decommission**: App Store review (checklist §9), then §8 in order. *Exit: app live, `frontend/` deleted, scorecast.club is a one-page landing with the privacy policy, backend serving mobile only.*

## 12. Risks & open questions

| Risk | Mitigation |
|---|---|
| better-auth Expo plugin version drift (the repo pins better-auth ^1.4.17) | P1 spikes the auth loop first, upgrading better-auth on the backend if the Expo plugin needs it — while the web app still exists to catch regressions. |
| SVG crest rendering quirks in expo-image | `TeamCrest` isolates the choice; `SvgUri` fallback behind the same props. |
| Carrier CGNAT vs per-IP rate limit | Fixed in P0 (§4.6) — before there are mobile users to throttle. |
| App Review "gambling" misread of predictions | Review notes state: no stakes, no prizes, free entry (§9.7). |
| League creation stays admin-only | Deliberate parity — opening creation to everyone is a product change, explicitly out of scope. |
| Football-data red cards need paid tier | Unchanged from web; indicator simply shows 0 (existing behavior). |

**Open questions (decide by the phase that needs them):**
1. Sentry (or nothing) for crash reporting — decide in P7. Recommendation: yes, `sentry-expo`, free tier.
2. App icon / brand mark direction — no logo exists beyond the wordmark. Needed by P7; explored in `MOBILE_DESIGN_SPEC.md`.
3. Whether Query caching warrants offline persistence (`@tanstack/query-persist-client` + AsyncStorage) — default **no** for V1; revisit if beta feedback complains about cold-start blankness.
4. Android timing — nothing in this plan blocks it; revisit after iOS launch.
