# ScoreCast — App Store Listing & Submission (PS3)

**Status:** Spec complete; `LS*` build slices defined (§9), not started.
**Parent:** `MOBILE_PLAN.md` §9 (submission checklist) + §8 (decommission), `MOBILE_SLICES.md` Stage F. This doc turns §9 into concrete, decision-complete listing content + assets and cuts the launch prep into `LS*` slices.

Everything below is a recommendation you can tweak — but it's complete enough to ship as-is. Copy limits are the App Store Connect maximums.

---

## 1. Identity

| Field | Value | Limit |
|---|---|---|
| App name | **ScoreCast** | 30 |
| Subtitle | **Football predictions with friends** | 30 |
| Bundle ID | `club.scorecast.app` | — |
| Primary category | **Sports** | — |
| Secondary category | Games › Trivia *(optional; boosts discovery)* | — |
| Age rating | **4+** (no objectionable content; **not** gambling — see §6) | — |

> App name uniqueness: "ScoreCast" may collide on the App Store. Fallback display names if taken: **"ScoreCast Predictions"** or **"ScoreCast Footy"**. Check availability in App Store Connect first (LS4).

---

## 2. Keywords (100 chars, comma-separated, no spaces after commas)

```
football,soccer,predictions,predictor,premier league,champions league,fantasy,league,friends,EPL,UCL,sports
```
(96 chars.) Don't repeat the app name or subtitle words — they're already indexed. Singular forms also match plurals.

---

## 3. Description

**Promotional text** (170 chars, updatable without review):
> Predict Premier League & Champions League scorelines, go head-to-head with your mates, and climb the table every gameweek. Free to play.

**Description** (4000 chars):
```
ScoreCast turns every matchday into a competition with your friends.

Predict the exact scorelines for Premier League and Champions League fixtures, earn points for every correct call, and climb your private league table across the season.

HOW IT WORKS
• Create or join a private league with an invite code
• Predict the score of every match before the deadline
• Earn 3 points for an exact score, 1 for the right result
• Watch the table update as results come in

BUILT FOR THE GROUP CHAT
• Private leagues — just you and the people you invite
• A live table so everyone knows who's on top
• Gameweek-by-gameweek standings and season totals

NEVER MISS A DEADLINE
• Push reminders before predictions lock
• Instant alerts when your results are scored
• A summary when each gameweek wraps up

Pick your team, make your predictions, and prove you know football better than your friends.

No stakes, no wagers — just bragging rights.
```

---

## 4. Assets

### App icon (LS1)
- **1024×1024 PNG, no alpha, no rounded corners** (Apple masks). Plus the in-app icon Expo generates from `./assets/images/icon.png`.
- **Direction** (from the PS1 design system): the ScoreCast mark on a **purple→navy gradient** (the `plPurple #3d195b` → `uclNavy #04065c` brand axis), with a bold "SC" monogram or a stylized ball/target. Light, legible at small sizes, no thin strokes. The neon `#00ff87` may accent but not dominate (it's decorative-only per DS1).
- **Current state:** placeholder Expo icon — must be replaced.

### Splash (LS1)
- `expo-splash-screen`: brand mark centered on `#f1f5f9` (or a subtle brand-gradient wash). Replace the default `splash-icon.png`.

### Screenshots (LS3)
- **Required:** iPhone **6.9"** (1320×2868) OR **6.7"** (1290×2796) — one set covers all modern iPhones. 3–10 images; **5 recommended**.
- Optional: 6.5" only if targeting older device galleries — skip for V1.
- **Shot list** (captured from the dev/prod build on-device or simulator, framed with a one-line caption each):
  1. **Leagues home** — PL + UCL countdowns + a league card with your rank. Caption: "Every gameweek, one table."
  2. **Predict flow** — score inputs mid-entry. Caption: "Call the exact score."
  3. **League table** — standings with your row highlighted. Caption: "Climb past your mates."
  4. **Predictions + points** — settled predictions with PointsBadges. Caption: "3 for exact, 1 for the result."
  5. **A push notification** (composited on a lock screen) — deadline reminder. Caption: "Never miss a deadline."
- Use a real populated league (the review test account's league, §7) so shots aren't empty.

---

## 5. Privacy (LS2 + LS4)

### Privacy policy page (LS2) — required URL
Host a static **/privacy** page at **scorecast.club** (the domain survives decommission per MOBILE_PLAN §8). Must state:
- **Data collected:** name, email, username (account); your predictions; a device push token (for notifications). No location, no contacts, no ads, no third-party tracking/analytics SDKs (unless Sentry is added — then list "crash diagnostics").
- **Why:** to run your account, leagues, scoring, and notifications.
- **Sharing:** none sold; processors only (hosting, email delivery via Resend, push via Expo/Apple).
- **Deletion:** account + all data deletable in-app (Account → Delete account).
- **Contact:** support email.

### App Store privacy "nutrition label" answers (LS4)
- **Data linked to you:** Contact Info (email, name), User Content (predictions), Identifiers (user ID). Used for **App Functionality** only.
- **Tracking:** **No** — nothing tracks you across other apps/sites. (No `App Tracking Transparency` prompt needed.)
- **Data used to track you:** none.
- If Sentry lands: add **Diagnostics → Crash Data**, not linked to identity, App Functionality.

---

## 6. Review package (LS5)

- **Test account** — a **pre-verified** account, member of a **populated league** with fixtures + some scored predictions, so the reviewer sees real content (not empty states). Seed it directly in the DB or via a script; put credentials in the review notes.
- **Review notes** (the text that ships with the submission):
  > ScoreCast is a free football-predictions game for private friend leagues. Sign in with the provided test account (already verified and in an active league). To try the core loop: open a league → Predictions → Make predictions → submit.
  >
  > IMPORTANT — this is NOT gambling. There are no entry fees, no wagers, no cash or prizes of any kind. Predictions are free and the only outcome is a leaderboard position (bragging rights). Please rate 4+.
  >
  > Account deletion is available in-app: Account tab → Delete account.
  >
  > Push notifications: deadline reminders and result alerts. Permission is requested after the first prediction.
- **Sign in with Apple:** **not required** — the app offers only email/password (no third-party/social login), so Apple's SIWA mandate doesn't apply.
- **Account deletion:** in-app (MS16) — reviewers check for this; it's done.
- **Support URL:** scorecast.club (or a support email).

---

## 7. Prerequisites already in place
- ✅ Apple Developer Program enrolled; bundle ID registered; push key + distribution cert provisioned (NS6).
- ✅ EAS project linked (`scorecast`, owner qadzilla); `eas.json` has `preview`/`production` profiles.
- ✅ In-app account deletion (MS16). ✅ Encryption exemption declared (`ITSAppUsesNonExemptEncryption: false`).
- ⏳ Crash reporting (`sentry-expo`) — MOBILE_PLAN §12 open question; **recommend yes** before public launch (decide in MS17). If added, update privacy labels (§5).

---

## 8. Open questions
1. **App icon artwork** — no designer asset exists. Options: (a) I generate a clean typographic/gradient icon programmatically, (b) you provide artwork, (c) commission one. LS1 is blocked until this is decided. **Recommendation:** start with (a) — a strong wordmark/monogram on the brand gradient is enough to ship; refine later.
2. **App name availability** — verify "ScoreCast" is free in App Store Connect; fall back to §1 alternatives.
3. **TestFlight beta vs straight to review** — **recommend TestFlight first** (your league group) to shake out real-world issues before public review.
4. **Support email** — need one (e.g. `support@scorecast.club` or a personal address) for the listing + privacy page.

---

## 9. LS* build slices

Registered into `MOBILE_SLICES.md`. LS1 (icon) gates screenshots (LS3) and TestFlight (MS17). LS2 (privacy) and LS5 (test account) are independent and can run anytime.

| Slice | Title | Deliverable & exit |
|---|---|---|
| **LS1** | App icon + splash | Final 1024² icon (no alpha) + splash wired into `app.json`, replacing the Expo placeholders; a production EAS build shows the new icon on the home screen. Blocked on the §8.1 artwork decision. **Exit:** brand icon renders on-device; `expo-doctor` clean. |
| **LS2** | Privacy policy page | Static `/privacy` page live at scorecast.club with §5 content; URL resolves 200. **Exit:** page reachable; ready to paste into App Store Connect. |
| **LS3** | Screenshots | The 5-shot set (§4) at 6.9"/6.7", framed with captions, from a populated league. **Exit:** 5 store-ready PNGs at the correct resolution. |
| **LS4** | App Store Connect listing | App record created; name/subtitle/keywords/description/promo/category/age-rating filled; privacy labels (§5) answered; screenshots (LS3) + icon (LS1) uploaded; privacy URL (LS2) set. **Exit:** listing complete, "Ready to Submit" minus the build. |
| **LS5** | Review package | Seed the pre-verified test account in a populated league; finalize review-notes text (§6). **Exit:** reviewer can log in and see a populated league; notes saved for submission. |

**Order:** LS1 → LS3 → LS4; LS2 and LS5 in parallel. All feed **MS17 (TestFlight)** and **MS19 (submission)**.
