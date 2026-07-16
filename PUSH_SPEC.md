# ScoreCast Push Notifications — Spec (PS2)

**Status:** Spec complete; NS* build slices defined (§7), not started.
**Parent:** `MOBILE_PLAN.md` §4.5 + §7 (the contract), `MOBILE_SLICES.md` Stage E. This doc resolves every open decision §7 left and cuts the work into `NS*` slices. When this and MOBILE_PLAN disagree, this wins for push specifics.

Push is the one net-new feature of the mobile app (MOBILE_PLAN §0). Everything else was a port; this is why a predictions game belongs on a phone.

---

## 1. Decisions locked (resolving MOBILE_PLAN §7 open questions)

| Question | Decision | Why |
|---|---|---|
| Delivery transport | **Expo Push Service** (`expo-server-sdk` on the server, `expo-notifications` on the client) | No direct APNs code; Expo handles the APNs cert plumbing. Matches the RN stack. |
| Dedup mechanism | **`push_log` table** with a unique key per (user, subject, kind) | Robust idempotent dedup for reminder crons that re-run every 30 min and a results cron that re-scores every 15 min. Also an audit trail. Chosen over `remindedAt` markers (harder per-user). |
| Preference storage | **`notification_pref` table**, keyed by `user_id` (not per-device) | Prefs are the person's, not the phone's — a user with two devices has one set of prefs. Kept off the better-auth `user` table to avoid touching auth-managed columns. |
| Quiet hours | **None in V1** | The whole value is time-sensitive (a 1-hour-before reminder at 22:30 is still useful the night before a morning deadline). Revisit if beta complains. |
| Token pruning | **Prune on `DeviceNotRegistered`** — both at send (ticket errors) and via a **receipt check ~15 min after each send batch** | Expo's recommended flow. Tokens rotate and apps get uninstalled; unpruned tokens waste sends and skew counts. |
| Permission prompt timing | **Contextual: after the user's first successful prediction submission** | Higher grant rate than a cold launch-time prompt. A pre-prompt explains the value before the OS dialog. |
| Android | Config only in V1 (Expo push is cross-platform); **iOS is the delivery target** | Matches the iOS-first decision (§0). Nothing here blocks Android. |

---

## 2. Notification types (V1) — final copy

All titles are "ScoreCast" (the app name shows as the notification header on iOS); the strings below are the **body** unless a **title** is given. `{…}` are interpolated. Tapping any notification deep-links **in-app** to the relevant league (payload `{ leagueId, screen }`) — no external URLs.

| # | Kind (`push_log.kind`) | Trigger | Copy | Audience | Pref gate |
|---|---|---|---|---|---|
| 1 | `deadline_24h` | 23.5–24h before a gameweek deadline | **title** "⏳ GW{n} locks tomorrow" · body "{k} matches to predict in {leagueName} — deadline {HH:mm}." | League members of that competition **who have not submitted** predictions for the gameweek | `deadlines` |
| 2 | `deadline_1h` | 0.5–1h before deadline | **title** "⏰ 1 hour left" · body "Lock in your GW{n} predictions for {leagueName}." | Same, still-unsubmitted only | `deadlines` |
| 3 | `results` | A match the user predicted gets scored (results cron) | 1 match: "FT: {home} {hs}–{as} {away} — you scored {pts} pts." · batch (≥2 in one tick): "{k} results in — you scored {totalPts} pts this round." | Users with a prediction on the scored match(es), per league | `results` |
| 4 | `gw_complete` | Last match of a gameweek finishes | **title** "GW{n} done" · body "You finished {rank} in {leagueName} on {gwPts} pts." | All members of leagues on that gameweek's competition | `updates` |

**Batching rule (type 3):** within one `runResultsUpdate` tick, collapse all of a user's newly-scored matches **per league** into a single notification. One user in three leagues who predicted the same match gets up to three notifications (one per league) — acceptable; leagues are the unit of competition.

**Pluralization & fallbacks:** "1 pt" vs "{n} pts"; if `rank`/`gwPts` unavailable, fall back to type-3-style summary. Copy lives in one `backend/src/services/pushCopy.ts` module (not scattered), so it's translatable later.

---

## 3. Schema (migrations)

### `009_notification_pref`
```
notification_pref (
  user_id   TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  deadlines BOOLEAN NOT NULL DEFAULT true,
  results   BOOLEAN NOT NULL DEFAULT true,
  updates   BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```
Absent row = all-on (defaults). Upserted when the user first toggles.

### `010_push_log`
```
push_log (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,           -- deadline_24h | deadline_1h | results | gw_complete
  subject_id TEXT NOT NULL,           -- gameweekId (deadline/gw_complete) or matchId (results)
  league_id  TEXT,                    -- null for competition-wide; set for per-league dedup
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, kind, subject_id, league_id)
)
```
The unique constraint IS the dedup: "insert the log row; if it conflicts, we already notified — skip." `push_token` (from MS6) already exists and carries the device tokens; deleting a user cascades both tables.

> NULL in a UNIQUE column doesn't collide in Postgres. For competition-wide kinds (`gw_complete`, deadline reminders) we always set `league_id` to the specific league so the row is per-(user,league,gameweek) — never rely on NULL uniqueness.

---

## 4. Backend architecture

- **`services/push.ts`** — the sender. `sendToUser(userId, {title, body, data})` and `sendBulk(messages[])`: fetch the user's tokens, build Expo messages, chunk (`expo.chunkPushNotifications`), send, collect tickets. On a `DeviceNotRegistered` ticket error, call `pruneToken` (MS6). Store ticket IDs for the receipt check. Fire-and-forget from cron — **a push failure must never fail a sync/scoring job** (wrap every call).
- **`services/pushCopy.ts`** — the copy table (§2) as pure functions.
- **`notifyIfAllowed(userId, kind, subjectId, leagueId, message)`** — the guarded send: checks `notification_pref`, attempts the `push_log` insert (skip on conflict), then sends. This is the single choke point every trigger goes through.
- **Triggers:**
  - *Deadline reminders* — **new cron `*/30 * * * *`**. Find gameweeks whose deadline falls in [now+23.5h, now+24h] (→ `deadline_24h`) or [now+0.5h, now+1h] (→ `deadline_1h`). For each, find members of leagues on that competition who lack a submitted prediction for the gameweek, and `notifyIfAllowed`.
  - *Results + GW-complete* — **hook into the existing `runResultsUpdate`** (`backend/src/index.ts`), after scoring. Collect the matches scored this tick; for each, the users+leagues who predicted it → type-3 (batched per user per league). Then detect gameweeks that just became fully finished → type-4 to members.
- **Endpoints** (requireAuth): `GET /api/notifications/prefs`, `PUT /api/notifications/prefs {deadlines,results,updates}`. (Token register/unregister already exist from MS6.)
- **Dependency:** `npm i expo-server-sdk` on the backend.

---

## 5. Client architecture

- **`lib/notifications.ts`** — `registerForPush()`: request permission (after the pre-prompt), `getExpoPushTokenAsync({ projectId })`, `POST /api/push/register`. `unregister()` on sign-out. Re-register on app start if permission already granted (tokens rotate). A notification-response listener routes taps to `/league/[id]` from `data.leagueId`.
- **Permission flow** — a lightweight pre-prompt (sheet or inline card) shown right after the first successful prediction submit (MS15's success path): "Want a reminder before deadlines?" → on Yes, trigger the OS prompt. Never prompt at launch.
- **Preferences** — wire the **MS16 placeholder switches** to `GET/PUT /api/notifications/prefs` (optimistic update + invalidate).
- **Config** — `expo-notifications` plugin in `app.json`; `projectId` for push tokens comes from EAS (needs the project linked). iOS entitlement (`aps-environment`) is added by the config plugin; **a dev build is required** — Expo Go can't receive push.

---

## 6. Constraints & prerequisites

- **Apple Developer Program ($99/yr)** — for the APNs key Expo uses. Enroll early (verification takes days). *This is the gate for NS6 (on-device delivery), not for building NS1–NS5.*
- **Physical device + EAS dev build** — no push on the simulator or Expo Go.
- **Testing without waiting for real fixtures:** the reminder/results logic is verified by temporarily shrinking the cron windows / pointing at a near-deadline gameweek, and by a dev-only "send test push" path. Unit tests mock `expo-server-sdk` and assert `notifyIfAllowed` dedup + pref gating.

---

## 7. NS* build slices

Registered into `MOBILE_SLICES.md`. Backend slices (NS1–NS3) need no Apple account and are testable with a mocked Expo SDK. Client slices (NS4–NS5) build without it; NS6 (delivery) is the only account-gated slice.

| Slice | Title | Deliverable & exit |
|---|---|---|
| **NS1** | Push infra + prefs | `expo-server-sdk`; migrations `009_notification_pref` + `010_push_log`; `services/push.ts` (send/chunk/prune) + `pushCopy.ts` + `notifyIfAllowed` choke point; `GET/PUT /api/notifications/prefs`. **Exit:** vitest covers pref-gating and `push_log` dedup (same send twice → one delivery) with a mocked Expo SDK; prefs endpoints 401 unauth, round-trip authed. |
| **NS2** | Deadline reminder cron | `*/30` cron; 24h + 1h window queries; unsubmitted-members filter; `notifyIfAllowed` per member. **Exit:** test seeds a gameweek with a deadline inside each window + members with/without predictions → asserts exactly the unsubmitted members are notified once each; re-running the tick sends nothing new. |
| **NS3** | Results + GW-complete triggers | Hook into `runResultsUpdate`: per-user-per-league results batching; full-gameweek detection → `gw_complete`. **Exit:** test scores a match with predictors across leagues → one results push per (user,league); re-score (idempotent) sends nothing; finishing the last match fires `gw_complete` once per member. |
| **NS4** | Client register + tap-routing | `expo-notifications`, `lib/notifications.ts`, contextual permission pre-prompt after first prediction, register on grant / app-start / unregister on sign-out, tap → league. **Exit:** on a dev build, granting permission registers a token (row in `push_token`); tapping a (manually-sent) notification opens the right league. |
| **NS5** | Preference toggles | Wire MS16's switches to `GET/PUT /api/notifications/prefs` (optimistic). **Exit:** toggling a switch persists across relaunch; a disabled category is not delivered (verified against NS1's gate). |
| **NS6** | On-device delivery pass 🍎 | Requires Apple Developer account + EAS dev build on a physical iPhone. Shrink cron windows locally; drive all four types. **Exit (Stage E gate):** all 4 notification types received on a real iPhone from real cron runs; prefs honored; opt-out verified; tapping routes correctly. |

**Order:** NS1 → (NS2 ∥ NS3) → NS4 → NS5 → NS6. NS1–NS3 (backend) can all land before the Apple account clears; NS4–NS5 build against it but only NS6 needs a device to *verify*.
