# ScoreCast Mobile — Slice Roadmap

**Status:** MS0 shipped (2026-07-15). Next up: MS1.
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

### MS1 — Backend hygiene  *(§4.6)*
`GET /health`; raise/re-key the general rate limiter (CGNAT problem); wire or delete `middleware/sanitize.ts`.
**Depends on:** MS0.
**Exit:** `/health` returns 200 in prod; limiter change covered by a test; sanitize.ts either mounted in `app.ts` or gone.

### MS2 — Native auth transport  *(§4.1)*
Add `@better-auth/expo`'s `expo()` plugin server-side; `scorecast://` in `trustedOrigins`; upgrade better-auth if the plugin requires it (this is the version-drift spike from §12 — do it now, while the web app exists to catch regressions).
**Depends on:** MS1.
**Exit:** better-auth upgraded/pinned; all backend auth tests pass; **web login/signup still works in prod** (the regression canary).

### MS3 — Email verification OTP  *(§4.2)*
`emailOTP` plugin, OTP email template via existing `sendEmail()`, link flow left enabled in parallel. Vitest coverage: send, verify, expiry, resend rate-limit.
**Depends on:** MS2.
**Exit:** curl-driven signup → OTP email arrives → verify endpoint flips `emailVerified`; web link flow still works.

### MS4 — `/api/user/me` + admin consolidation  *(§4.4)*
New `GET /api/user/me` returning profile + server-computed `isAdmin`; consolidate `ADMIN_EMAIL`/`ADMIN_EMAILS` onto the plural with a deprecation fallback.
**Depends on:** MS1.
**Exit:** `/me` returns `isAdmin: true` only for admin emails; leagues + admin routes both honor `ADMIN_EMAILS`; tests updated.

### MS5 — Account deletion  *(§4.3)*
FK-cascade audit across `prediction`, `league_member`, `league.createdBy`, `session`, `account`, `verification`; migration for any missing `ON DELETE` actions; deletion endpoint (better-auth `deleteUser` or custom `DELETE /api/user/account`) in one transaction.
**Depends on:** MS2.
**Exit:** test creates a user with predictions + memberships, deletes them, verifies zero orphan rows and that their league's other members' leaderboard still computes.

### MS6 — Push-token registry  *(§4.5, schema only — senders wait for NS\*)*
Migration `007_push_tokens`; `POST/DELETE /api/push/register`; token pruning hook stubbed.
**Depends on:** MS1. (MS5's cascade audit should include this table — if MS5 lands first, add the FK there; order between MS4/MS5/MS6 is flexible.)
**Exit:** register/unregister round-trip via curl; re-register upserts rather than duplicates; deleting a user removes their tokens.

**Stage A gate:** backend is fully mobile-ready; the live website has not changed behavior once.

---

## Stage B — App foundation

### PS1 — Write `MOBILE_DESIGN_SPEC.md` 🗎  *(§6, §10)*
**Planning slice.** Take §6's tokens and rules and produce the screen-by-screen visual spec: exact layouts and every component state (loading / empty / error / locked / finished / offline) for all screens in §5.4, the auth-screen light redesign, and app-icon direction. **The spec must end in a `DS*` slice table** — expected shape (PS1 may cut it differently, that's its job): tokens+fonts foundation → component slices grouped by screen cluster → per-screen polish slices. Register `DS*` into the tracker.
**Depends on:** nothing (can run parallel to Stage A).
**Exit:** `MOBILE_DESIGN_SPEC.md` exists, covers every §5.4 screen and §6.3 component, ends in a `DS*` slice table, and the tracker below lists `DS*`.

### MS7 — Expo scaffold  *(§5.1, §5.2)*
`mobile/` app: Expo SDK 54, TS strict, Expo Router skeleton with `(auth)`/`(tabs)` groups and placeholder screens, Plus Jakarta Sans loading, `theme.ts` tokens (from PS1's final values), QueryClient + API client (`lib/api.ts` port) pointed at local backend, `EXPO_PUBLIC_API_URL` wiring.
**Depends on:** PS1 (tokens finalized), MS1 (`/health` to hit).
**Exit:** simulator boots to a placeholder login screen in the brand font; a debug screen fetches `/health` and renders the response.

### MS8 — Component library  *(§6.3, executes early `DS*` slices)*
Build the core components per the design spec, each demoed in a dev-only gallery route. This slice (or slices — follow the `DS*` cut from PS1) covers: Button, Card, TextField, ScreenHeader, SegmentedControl, CountdownCard, MatchRow, ScoreInput, PointsBadge, TeamCrest (expo-image + SVG fallback decision verified against real crest URLs), LeaderboardRow, EmptyState, Sheet, StatTile, Banner.
**Depends on:** MS7, PS1.
**Exit:** gallery renders every component in every designed state; TeamCrest verified against ≥5 real `crests.football-data.org` URLs including at least one SVG.

**Stage B gate:** an empty but branded, navigable app shell with a complete component kit.

---

## Stage C — Auth & onboarding

### MS9 — Auth client + login  *(§5.4 login, §4.1)*
better-auth Expo client + SecureStore; login screen (identifier lookup → `signIn.email`, 429 + invalid-credential error mapping); session persistence across app relaunch; root-layout auth gate (session → tabs, none → auth stack).
**Depends on:** MS8, MS2.
**Exit:** login with a real account on simulator → lands in (placeholder) tabs; kill + relaunch app → still logged in; sign-out returns to login.

### MS10 — Signup + OTP verify  *(§5.4 signup/verify, §4.2)*
Signup form (RHF + Zod schemas ported from `lib/validation.ts`), verify screen (6 boxes, auto-advance, paste, `oneTimeCode` content type, resend w/ 60s cooldown), post-verify sign-in.
**Depends on:** MS9, MS3.
**Exit:** full new-account flow on simulator: signup → real OTP email → typed code → signed in. Duplicate-email and bad-code paths render designed errors.

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
| MS0 | Security check & repo scrub | A | ✅ 2026-07-15 | (this commit) |
| MS1 | Backend hygiene | A | ☐ | |
| MS2 | Native auth transport | A | ☐ | |
| MS3 | Email verification OTP | A | ☐ | |
| MS4 | `/api/user/me` + admin consolidation | A | ☐ | |
| MS5 | Account deletion | A | ☐ | |
| MS6 | Push-token registry | A | ☐ | |
| PS1 🗎 | MOBILE_DESIGN_SPEC.md (→ registers `DS*`) | B | ☐ | |
| MS7 | Expo scaffold | B | ☐ | |
| MS8 | Component library (executes `DS*`) | B | ☐ | |
| MS9 | Auth client + login | C | ☐ | |
| MS10 | Signup + OTP verify | C | ☐ | |
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
