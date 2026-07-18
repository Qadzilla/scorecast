# ScoreCast — App Store Publishing Guide

A concrete, do-this-then-that walkthrough to get ScoreCast onto the App Store, using *your* real setup. Work top to bottom. Companion to `STORE_LISTING.md` (the copy/metadata source of truth).

**The mental model:** `build → upload to TestFlight → test → fill the store listing → attach the build → submit → review → release`. The build and the listing are two separate tracks that meet at "Submit."

**Your facts (used throughout):**
- Bundle ID: `club.scorecast.app`
- EAS project: `scorecast` (owner `qadzilla`), projectId `3feb83e7-d0ec-47ec-bdc2-9473430ce3ba`
- App name: **ScoreCast** · Subtitle: **Football predictions with friends** · Category: **Sports** · Age: **4+**
- URLs: Privacy `https://scorecast.club/privacy.html` · Support/Marketing `scorecast.club` · Support email `support@scorecast.club`
- Reviewer login: `review@scorecast.club` / `ScoreCastReview!2026`
- API (prod): `https://api.scorecast.club` (Railway) · DB: Neon · Email: Resend

---

## Step 0 — Before you start

**Already done — don't redo:** Apple Developer Program enrolled; bundle registered; push key + distribution cert provisioned; EAS linked; app icon + splash wired; privacy page live; reviewer-seed script exists; in-app account deletion; encryption exemption declared; no payments/location anywhere.

**Still to do (this guide):** ① resolve the prize-pool framing · ② one-time config · ③ create the ASC app record · ④ build to TestFlight · ⑤ test · ⑥ screenshots · ⑦ fill the listing · ⑧ reviewer account · ⑨ submit.

**Tools check:**
```bash
cd /Users/zaid/Desktop/premier-league-predictions/code/mobile
eas whoami          # should print your Expo account; if not: eas login
```
You'll also need access to **App Store Connect** (https://appstoreconnect.apple.com) with your Apple ID.

---

## Step 1 — ⚠️ Resolve the prize-pool question FIRST (biggest rejection risk)

Your store listing was written before the prize pool existed. It literally says *"No stakes, no wagers — just bragging rights,"* and the review notes claim *"NOT gambling — no entry fees, wagers, cash or prizes."* The app now has a **prize pool** (admin sets a per-head entry fee; 1st/2nd/3rd/2nd-last payouts, "money back"). Apple reviewers will see "entry fee" + "prize" and think **real-money gaming (Guideline 5.3)** or **missing in-app purchase (3.1.1)**. If the copy says "no entry fees" while the app shows an entry fee, that's an instant, credibility-damaging rejection.

You must pick one **before submitting**:

### Option A — Keep the prize pool, reframe it as a display-only tracker (higher risk)
Only viable because **no money moves through the app** (it's a scoreboard; friends settle offline). To do this:
1. **Rewrite the listing copy** — remove "No stakes/no wagers/no entry fees" absolutes. Say instead: *"Optional friendly stakes are tracked for you — the app never handles money; settle up however you like."*
2. **Rewrite the review notes** (Step 8) to state plainly, first line: *"This app processes NO payments. There is no in-app purchase, no card entry, no wallet, no money transfer. The 'prize pool' is a display-only calculator; any settlement happens offline between friends. Please review under the standard rules, not 5.3."*
3. **Confirm there is genuinely zero payment mechanism** in the app (there is none today — keep it that way).
4. Consider softening in-app wording: "stakes" instead of "entry fee/prize pool" (optional).

Risk: even with perfect notes, a reviewer may still balk. Budget for one rejection + appeal.

### Option B — Hide the prize pool for v1, ship the clean app (recommended)
Submit the "bragging rights" app that **matches your existing listing**, get approved fast, then turn the pool on in a later update (by which point you have a track record and can frame it carefully).

How to hide it without deleting code — gate the prize-pool UI behind a flag:
- Add a constant, e.g. `export const PRIZE_POOL_ENABLED = false;` in `mobile/src/constants/flags.ts`.
- Guard the surfaces: the `PrizePoolCard` render in `league/[id].tsx` (Table pane), the prize-pool section in `create.tsx` + `manage.tsx`, and the medal/orange logic that depends on payouts. Wrap each in `PRIZE_POOL_ENABLED ? … : null`.
- Leave the backend as-is (unused endpoints are harmless). Flip the flag to `true` in the update that reintroduces it.

**Recommendation: Option B for the first submission.** Clean approval, no gambling debate, and the listing already matches. Decide now — everything downstream depends on it.

> If you pick B, do the feature-flagging now (before Step 4's build). If you pick A, rewrite the copy now (before Step 7).

---

## Step 2 — One-time config

1. **`eas.json` submit config is empty** (`submit.production: {}`), so `eas submit` will prompt you interactively for Apple ID / team / app. That's fine for a one-off. To make it non-interactive later, add:
   ```jsonc
   "submit": {
     "production": {
       "ios": {
         "appleId": "you@apple-id.com",
         "ascAppId": "<numeric App Store Connect app ID from Step 3>",
         "appleTeamId": "<10-char team id>"
       }
     }
   }
   ```
   You can skip this and just answer the prompts.

2. **Encryption compliance** — already handled (`ITSAppUsesNonExemptEncryption: false` in `app.json`), so you won't get the "export compliance" question each submit. Nothing to do.

3. **Privacy manifest** — `app.json` has no `ios.privacyManifests`. Expo SDK 54 auto-generates a baseline `PrivacyInfo.xcprivacy`, which is usually enough for this app (no ad SDKs). If a submission is ever flagged for a "required reason API" declaration, add an `ios.privacyManifests` block. Not a blocker for the first build — just know it exists.

4. **Crash reporting (Sentry) — decide now.** Not installed. Recommended before a *public* launch (not required for TestFlight). If you add `@sentry/react-native` later, you **must** update the App Privacy labels (add Diagnostics → Crash Data, not linked to identity). For the first submission it's optional — you can add it in the next update.

---

## Step 3 — Create the App Store Connect app record

`eas submit` needs the app to already exist in App Store Connect.

1. https://appstoreconnect.apple.com → **My Apps → ➕ → New App**.
2. Fill:
   - **Platforms:** iOS
   - **Name:** `ScoreCast` (if taken, App Store Connect tells you here — fall back to **"ScoreCast Predictions"** or **"ScoreCast Footy"**; whatever you pick is the store name, independent of the bundle id)
   - **Primary Language:** English (U.K.) or (U.S.)
   - **Bundle ID:** `club.scorecast.app` (select from the dropdown; if missing, it wasn't registered — register at developer.apple.com → Identifiers)
   - **SKU:** any internal string, e.g. `scorecast-ios-01`
   - **User Access:** Full Access
3. Create. You now have an app record (note its **numeric Apple ID** in the URL/App Information — that's `ascAppId` for Step 2).

---

## Step 4 — Build → TestFlight

From `mobile/`:
```bash
cd /Users/zaid/Desktop/premier-league-predictions/code/mobile
eas build --platform ios --profile production --auto-submit
```
- `production` profile auto-increments the build number on EAS servers (`appVersionSource: "remote"`), so you never touch `buildNumber`.
- `--auto-submit` uploads the finished binary straight to App Store Connect / TestFlight.
- **APNs / push:** the app registers for push. Your push key is already provisioned, but if the build warns about credentials, run `eas credentials` (platform iOS → Push Notifications) once and let EAS manage the APNs key.
- **Timing:** ~10–20 min build on EAS, then ~5–15 min Apple processing before it appears in TestFlight.
- First `--auto-submit` may prompt for your Apple ID + an app-specific password (appleid.apple.com → Sign-In & Security → App-Specific Passwords). It caches after that.

While it builds, do Steps 5–8 prep.

> Reminder: a production build is **frozen** — it does not hot-reload. Any JS change means a new build. So make the Step 1 decision *before* this build.

---

## Step 5 — Test on TestFlight

1. App Store Connect → your app → **TestFlight**. The processed build appears; complete the **"Export Compliance"** prompt (answer: uses standard encryption / exempt → matches your `ITSAppUsesNonExemptEncryption:false`).
2. **Internal testers:** TestFlight → Internal Testing → add yourself + anyone on your team (must be in your App Store Connect users). They get an email + install via the **TestFlight app**.
3. **End-to-end checklist (must all pass):**
   - [ ] Welcome screen animates in; tap → continues
   - [ ] Sign up (email) → OTP email arrives (Resend) → verify
   - [ ] Team select → lands on Leagues
   - [ ] Join/create a league (or open the seeded one)
   - [ ] Make predictions → submit → they persist
   - [ ] League table shows standings; medals render
   - [ ] Trigger/receive a push (deadline reminder or result) — allow permission when prompted
   - [ ] Account → Delete account works (test on a throwaway account)
   - [ ] App points at prod (`api.scorecast.club`) — you're seeing real data
4. Fix anything → new `eas build` → repeat. Don't submit a build you haven't installed yourself.

---

## Step 6 — Screenshots (LS3)

Apple requires at least one iPhone size; upload **6.9″ (1320×2868)** *or* **6.7″ (1290×2796)** — one set covers modern iPhones. **5 screenshots** recommended.

**Shot list (from `STORE_LISTING.md §4`), captured from a populated league** (use the reviewer account or your Test League so nothing's empty):
1. Leagues home — *"Every gameweek, one table."*
2. Predict flow — *"Call the exact score."*
3. League table — *"Climb past your mates."*
4. Predictions + points — *"3 for exact, 1 for the result."*
5. Push notification on lock screen — *"Never miss a deadline."*

**How to capture:**
- **Simulator (easiest for exact sizes):** run the app on an iPhone 16 Pro Max simulator (6.9″), `Cmd+S` saves a correctly-sized PNG. (`npx expo run:ios` or a dev build; log in as the reviewer to get populated data.)
- **Real device:** screenshot on your iPhone, but sizes must match a required resolution — the simulator route is safer.
- Add the caption text in any image editor (or upload clean shots; captions are optional but recommended).
- If the prize pool is hidden (Option B), make sure no screenshot shows it.

Save the 5 PNGs; you'll upload them in Step 7.

---

## Step 7 — Fill the App Store listing (LS4)

App Store Connect → your app → the version (e.g. **1.0**) → fill every field. All copy lives in `STORE_LISTING.md`; use it verbatim.

- **Name:** ScoreCast · **Subtitle:** `Football predictions with friends`
- **Promotional Text** (updatable without review):
  > Predict Premier League & Champions League scorelines, go head-to-head with your mates, and climb the table every gameweek. Free to play.
- **Description:** paste the full §3 description from `STORE_LISTING.md`. **If you chose Option A**, edit the "No stakes, no wagers" closer per Step 1.
- **Keywords:** `football,soccer,predictions,predictor,premier league,champions league,fantasy,league,friends,EPL,UCL,sports` (no spaces after commas)
- **Support URL:** `https://scorecast.club` · **Marketing URL:** `https://scorecast.club`
- **Category:** Primary **Sports**; Secondary (optional) Games › Trivia
- **Screenshots:** upload the 5 from Step 6
- **App Icon:** pulled from the build automatically (1024×1024, no alpha) — nothing to upload here
- **Age Rating** (Edit → questionnaire): answer **No** to everything (no violence, no simulated gambling, no mature content) → yields **4+**. ⚠️ If you kept the prize pool (Option A), still answer "Simulated Gambling: No" — it's not gambling since no money is handled — but this is exactly why your review notes must be airtight.
- **App Privacy** (App Store Connect → App Privacy → Get Started):
  - **Data linked to you, used for App Functionality only:** Contact Info (email, name), User Content (predictions), Identifiers (user ID).
  - **Tracking: No** (no ATT prompt, no ad SDKs).
  - **Data used to track you: None.**
  - *(If you add Sentry later: add Diagnostics → Crash Data, not linked to identity.)*
- **Privacy Policy URL:** `https://scorecast.club/privacy.html` (confirm it loads first)

Save. The listing goes "Ready to Submit" once all required fields + screenshots + a build are attached.

---

## Step 8 — Reviewer / demo account + review notes

Apple needs a working login. Your seed script builds one against production.

1. **Run the seed** (needs the prod Neon `DATABASE_URL` — grab it from Railway's Postgres/Neon variables, use the *public* URL):
   ```bash
   cd /Users/zaid/Desktop/premier-league-predictions/code/backend
   DATABASE_URL='<prod-db-url>' npx tsx src/scripts/seed-review-account.ts
   ```
   Idempotent — safe to re-run. It creates `review@scorecast.club` (pre-verified), gives it a favourite team, drops it into the most-populated PL league, and predicts the nearest gameweek so no screen is empty.
2. **Verify:** log into the app (or TestFlight build) as `review@scorecast.club` / `ScoreCastReview!2026` and confirm you see a populated league + predictions.
3. **App Store Connect → App Review Information:**
   - **Sign-in required:** Yes → username `review@scorecast.club`, password `ScoreCastReview!2026`
   - **Notes:** paste the review notes from `STORE_LISTING.md §6`. **If Option A, prepend the "no payments" paragraph from Step 1.** Include: how to predict (open a league → Predictions → Make predictions → submit), that account deletion is in Account → Delete account, and that push = deadline/result alerts (permission asked after first prediction).
   - **Contact:** your name, phone, email.
4. **Confirm `support@scorecast.club` receives mail** (it's on the privacy page + listing). If that inbox doesn't exist, either create it (or an alias/forward) or swap it for a real address in the listing + privacy page before submitting.

---

## Step 9 — Submit for review

**Pre-submit checklist:**
- [ ] Step 1 decision executed (Option A copy updated, *or* Option B flag off + rebuilt)
- [ ] Build processed in TestFlight and **you installed + tested it**
- [ ] 5 screenshots uploaded
- [ ] All listing fields filled; Privacy Policy URL loads
- [ ] App Privacy labels answered; Age rating = 4+
- [ ] Reviewer account seeded + verified; creds + notes in App Review Information
- [ ] `support@scorecast.club` reachable

Then: version page → **Add Build** → pick the processed build → **Add for Review** → **Submit for Review**.

**What to expect:** status goes `Waiting for Review` → `In Review` → `Approved` (or `Rejected`). Typically 24–48h. You can pick **Manually release** or **Automatically release** after approval — choose **Manually** for the first one so you control the moment.

**If rejected (most likely on the gambling angle):** don't panic. Reply in **Resolution Center**: reiterate there is no in-app payment, no IAP, no money movement — the pool is a display-only calculator, settlement is offline. If they hold firm, the fastest path is **Option B** (flag the pool off, rebuild, resubmit). Other common ones: broken demo login (re-run the seed), missing privacy URL (check it loads), or a crash on launch (test the exact build again).

---

## Step 10 — After approval

1. **Release** the app (Manually → the button appears once Approved).
2. **Web decommission** (per `MOBILE_PLAN.md §8`) — *only after approval*: replace the `scorecast.club` site with a single static landing page (App Store badge/link + the privacy policy + support email), then you can delete `frontend/`. **Keep:** the `scorecast.club` domain, the Railway backend, Neon DB, Resend — the app depends on all of them.
3. Post-launch updates ship as new `eas build --auto-submit` runs; bump `version` in `app.json` for user-facing releases (build number auto-increments).

---

## Appendix — everything in one place

```
Bundle ID .............. club.scorecast.app
EAS project ............ scorecast (owner qadzilla)
EAS projectId .......... 3feb83e7-d0ec-47ec-bdc2-9473430ce3ba
App name ............... ScoreCast   (fallbacks: "ScoreCast Predictions" / "ScoreCast Footy")
Subtitle ............... Football predictions with friends
Category ............... Sports   (secondary: Games › Trivia)
Age rating ............. 4+
Keywords ............... football,soccer,predictions,predictor,premier league,champions league,fantasy,league,friends,EPL,UCL,sports
Privacy URL ............ https://scorecast.club/privacy.html
Support/Marketing ...... https://scorecast.club
Support email .......... support@scorecast.club
Reviewer login ......... review@scorecast.club / ScoreCastReview!2026
Prod API ............... https://api.scorecast.club   (Railway)
```

```bash
# Build + upload to TestFlight (from mobile/)
eas build --platform ios --profile production --auto-submit

# Seed the reviewer account (from backend/, with prod DB url)
DATABASE_URL='<prod-db-url>' npx tsx src/scripts/seed-review-account.ts

# Manage iOS credentials (APNs/certs) if prompted
eas credentials
```

**Config gaps to remember:** `eas.json` `submit.production` is empty (interactive submit, or fill it) · no `ios.privacyManifests` (baseline auto-generated) · no OTA/`runtimeVersion` (every update = a new build) · Sentry not installed (optional, add before public launch + update privacy labels).
