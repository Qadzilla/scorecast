# ScoreCast Mobile — UX Rework (Task-First Restructure)

**Status:** Written 2026-07-17. Diagnosis + target IA + execution slices `UXR1–UXR7`.
**Parents:** `MOBILE_DESIGN_SPEC.md` (visual tokens, component anatomy — unchanged) and the post-login screens as shipped (`src/app/(tabs)/*`, `src/app/league/*`).
**Scope:** **Structural only** — information architecture, screen composition, placement, navigation patterns, and task flow. This doc does **not** touch color, typography, or the design tokens; it inherits them verbatim from `MOBILE_DESIGN_SPEC.md`. Where it says "CTA" or "hero," style it with the existing blueprint tokens.

Design intent in one line: **reorganize the app around the recurring task (predict this week before the deadline), not around browsing its data (tables, fixtures, leagues).**

---

## 0. Root cause

The app is organized around **its data** — a league opens on the standings table, the home screen lists deadlines and leagues as static information, fixtures live in their own read-only tab. But the job a user opens ScoreCast to do, week after week, is **make my picks before the deadline**. That job is currently buried four taps deep, and the screen elements with the most visual weight (the home countdown cards) are dead-ends that do nothing when tapped.

Every symptom below is a consequence of that one inversion. The fix is a **re-arrangement**, not a rebuild — the component craft (skeletons, empty states, haptics, safe areas, the countdown hero) is already good.

---

## 1. Principles we are designing to

Each is backed by current mobile-UX research; sources in §9.

1. **Navigation holds destinations; the primary task gets a dedicated, persistent action.** Tab bars and segmented controls are for *places / views*, not *verbs*. Hiding the main path costs completion (NN/g: hidden navigation ≈ −21% task completion). [P-NAV]
2. **The primary action lives in the thumb zone (bottom third).** ~49% of users operate one-handed; the top of the screen is the hardest to reach. Sticky bottom bars and slide-up sheets are the correct home for the main CTA. [P-THUMB]
3. **Task-first surfaces: show what matters *now*, defer the rest.** One dominant action per screen; secondary data drops below or behind disclosure. If you can't state a screen's purpose in one sentence, it has too many jobs. [P-JTBD]
4. **Cut steps to success.** Smart defaults + contextual shortcuts. The most-repeated task should be 1–2 taps from launch. [P-STEPS]
5. **A segmented control filters ONE screen; it does not switch between different jobs.** "List vs grid," not "standings vs make-picks." (Apple HIG.) [P-SEG]
6. **Visual hierarchy encodes task importance.** The thing to do now is the largest/heaviest element; everything else is lighter. No uniform card-grid rhythm. [P-HIER]

---

## 2. Current-state audit (what's off, with anchors)

| # | Screen | Problem | Anchor | Principle |
|---|--------|---------|--------|-----------|
| A | Core loop | Predicting is **4 taps + 2 mode-switches**: Home → league → (Table) → Predictions segment → "Make/edit predictions" → predict | `league/[id].tsx:42`, `:104`, `:141` | P-STEPS |
| B | Home | The **countdown cards are the visual centerpiece but are dead-ends** — `DeadlineCard` renders a `CountdownCard` with no `onPress` | `(tabs)/index.tsx:64-67`, `:117-136` | P-JTBD, P-HIER |
| C | League detail | **Opens on Table** (a check-my-rank job) even when a deadline is open and the job is to predict | `league/[id].tsx:42` (`useState<Pane>("table")`) | P-JTBD |
| D | League detail | **Segmented control switches between three different jobs** (standings / browse fixtures / make picks), not three views of one dataset — a misuse of the pattern | `league/[id].tsx:104-113` | P-SEG |
| E | League detail | **Fixtures and Predictions are near-duplicate surfaces** — you predict *on* the fixtures; Fixtures is the same list minus the inputs | `FixturesPane` `:208`, `PredictScreen` rows `predict.tsx:174` | P-JTBD |
| F | League detail | **Primary CTA is mid-scroll inside one tab** — not persistent, not in the thumb zone | `league/[id].tsx:141-152` | P-THUMB, P-HIER |
| G | Home | **No "what do I still need to do this week" state** — deadlines and leagues are separate static lists; never shows predicted/total or which leagues still need picks | `(tabs)/index.tsx` whole | P-JTBD |
| H | All | **Uniform density, no focal point** — header, cards, hairline rows all at similar weight; nothing says "DO THIS NOW" | every screen | P-HIER |
| I | Account | **Heavy navy hero for a low-frequency utility screen** — visual weight exceeds task importance (minor) | `(tabs)/account.tsx:110-133` | P-HIER |

---

## 3. Target information architecture

### 3.1 Navigation model (unchanged shell, fixed depth)

Keep the **2-tab shell** (Leagues, Account) — 2 destinations is fine per P-NAV; the problem was never the tab count, it was the *depth to the task*. We fix depth with **contextual entry points and a persistent CTA**, not by adding tabs or putting a verb in the tab bar (which P-NAV/P-SEG forbid).

```
Tab: Leagues (Home)  ─┬─ "This week" actionable block  ──1 tap──▶ Predict
                      ├─ League row                     ──1 tap──▶ League detail
                      └─ (empty) Join / Create

Tab: Account          └─ settings (low frequency)

League detail ─ Predict · Table (2 segments) + sticky "Make predictions" bar
             └─ ⓘ info sheet / ⚙ manage (admin)
```

### 3.2 The core loop, re-budgeted

| Path | Taps today | Taps target |
|---|---|---|
| Home → make this week's picks (nearest open deadline) | 4 | **1** (tap the "This week" block / countdown) |
| Home → specific league → predict | 4 | **2** (league → sticky CTA) |
| Home → check my standing | 2 | 2 (league → Table) |

### 3.3 Pattern decisions

- **Countdown = primary CTA.** Anywhere a `CountdownCard` shows an *open* deadline, it is tappable and routes into predicting. Dead-end → front door. [P-JTBD]
- **Persistent bottom CTA on league detail.** Reuse the exact sticky-bar pattern already proven on the predict screen (`predict.tsx` `submitBar`). Visible from any pane. [P-THUMB]
- **Two segments, not three.** `Predict · Table`. Fixtures folds into Predict (read-only after the deadline). [P-SEG, P-JTBD]
- **Contextual default pane.** Deadline open → default **Predict**; deadline passed → default **Table**. [P-STEPS]
- **One focal element per screen.** Home = the "This week" block; League = the open-deadline state + CTA; everything else lighter. [P-HIER]

---

## 4. Per-screen target specs

Wireframes are structural (boxes = regions, not final pixels). Inherit all type/color/spacing from `MOBILE_DESIGN_SPEC.md`.

### 4.1 Home — "This week" (`(tabs)/index.tsx`)

**Purpose (one sentence):** *Show me what I still need to predict this week and get me into it in one tap.*

Replace the "Next deadlines (2 dead cards) + Your leagues (list)" stack with a **task-first** composition:

```
┌───────────────────────────────────────────┐
│  Welcome back                        [crest]│   ← unchanged header
│  Zaid                                       │
├───────────────────────────────────────────┤
│  THIS WEEK                                  │   ← focal block (largest weight)
│  ┌───────────────────────────────────────┐ │
│  │ Premier League · GW24        1d 04h ▸ │ │   ← tappable → Predict
│  │ ●●●○○  3 / 5 leagues predicted        │ │   ← actionable status (NEW)
│  │ [ Predict now ]                       │ │   ← 1-tap CTA
│  └───────────────────────────────────────┘ │
│  ┌───────────────────────────────────────┐ │
│  │ Champions League · MD5      closed    │ │   ← if closed: muted, → Table
│  └───────────────────────────────────────┘ │
├───────────────────────────────────────────┤
│  YOUR LEAGUES                      + Create │   ← secondary, lighter weight
│  ┌───────────────────────────────────────┐ │
│  │ Kickoff Kings   PL · 5      2nd  ·  ▸ │ │
│  │ Office League   UCL · 8     1st  ·  ▸ │ │
│  └───────────────────────────────────────┘ │
└───────────────────────────────────────────┘
```

Changes:
1. **"This week" block is the focal point** — one card per competition that has an active gameweek, carrying: competition + GW label, live countdown, **predicted/total-leagues progress**, and a **Predict now** CTA. Tapping anywhere on an open block routes to predict for that competition (see §4.2 target routing / §6 open Q1 on multi-league disambiguation).
2. **Deadline cards become actionable** (fixes B). Open → CTA + tappable; closed → muted, routes to that competition's most relevant league Table.
3. **Progress status is new** (fixes G): "3 / 5 leagues predicted" (or "Not predicted yet" / "All done ✓"). Derived from `usePredictions` across the user's leagues for the current GW.
4. **Leagues list demoted** to secondary weight below the fold — same `LeagueRow`, unchanged, just lower in hierarchy (fixes H).

Acceptance: from a cold Home with an open deadline, **one tap reaches the predict screen**; the block clearly states how many leagues still need picks.

### 4.2 League detail (`league/[id].tsx`)

**Purpose:** *Predict this week, or check where I stand.*

```
┌───────────────────────────────────────────┐
│ ‹  Kickoff Kings                    ⚙  ⓘ  │   ← ScreenHeader (unchanged)
├───────────────────────────────────────────┤
│  [ Predict ]  [  Table  ]                   │   ← 2 segments (was 3)
├───────────────────────────────────────────┤
│  (Predict pane — default when open)         │
│  ┌───────────────────────────────────────┐ │
│  │ GW24 · closes in 1d 04h        [hero] │ │   ← CountdownCard (tappable)
│  └───────────────────────────────────────┘ │
│  Sat 18 Jan                                 │   ← fixtures list, inline,
│  ┌───────────────────────────────────────┐ │      read-only after deadline
│  │ ARS  2 – 1  CHE          ✎/●3pts     │ │
│  │ ...                                    │ │
│                                             │
│  (scrolls)                                  │
│                                             │
├───────────────────────────────────────────┤
│  [        Make predictions        ]         │   ← STICKY bottom bar (thumb zone)
└───────────────────────────────────────────┘
```

Changes:
1. **Segments reduced to `Predict · Table`** (fixes D/E). `Fixtures` is absorbed — the Predict pane *is* the fixtures list.
2. **Contextual default** (fixes C): `useState<Pane>(deadlineOpen ? "predict" : "table")`.
3. **Sticky "Make predictions" bar** pinned bottom, visible from both panes (fixes F). Label mirrors state: `Make predictions` (open) / `View predictions` (closed). Reuse `predict.tsx` submit-bar styling.
4. **Predict pane** = countdown hero (tappable) + the current GW's fixtures inline. Before deadline the rows are entry affordances / a summary of what's entered; after deadline they show your pick + points. (Whether inputs live inline here or stay on the pushed predict screen is Open Q2 — default: keep the dedicated predict screen, this pane summarizes + the sticky bar opens it.)
5. **Table pane** unchanged (already good) — remains the "check my rank" surface; tapping a player still pushes `league/player`.

Acceptance: opening a league with an open deadline lands on **Predict**, the CTA is reachable one-thumb from anywhere, and there is no separate Fixtures tab.

### 4.3 Predict (`league/predict.tsx`)

Already the strongest screen structurally (sticky submit bar in the thumb zone — the pattern we're propagating). Changes are small:
1. **Becomes the single home for fixtures** — after the deadline it's the read-only "what everyone can see" view (already handles `finished`/locked rows).
2. Keep the hide/share slider work from the current release.
3. No layout inversion needed.

### 4.4 Account (`(tabs)/account.tsx`) — minor

1. **Lighten the hero** (fixes I): the navy block is high-craft but over-weighted for a settings screen. Options (pick in Open Q3): shrink to a single compact row (crest + name + @handle inline, no big stat tile), or keep the hero but drop it to normal card weight. Everything below (username, team, notifications, actions) stays.
2. No IA change otherwise — Account is correctly a flat settings list.

---

## 5. Cross-cutting patterns to introduce

1. **`ActionableDeadline` block** — the "This week" card: countdown + progress + CTA, tappable, used on Home (and optionally as the league Predict-pane hero). One component, two placements.
2. **`StickyActionBar`** — extract the predict submit-bar into a reusable bottom bar (thumb zone) used by league detail and predict.
3. **Contextual default routing** — a small helper: given the user's leagues + current GWs, resolve "the league/competition to drop the user into" for a one-tap Predict.
4. **Focal-weight rule** — per screen, exactly one region uses hero weight; document it in each screen's header comment so future edits don't re-flatten the hierarchy.

---

## 6. Decisions to confirm before build

- **Q1 — One-tap Predict target when a competition has multiple leagues.** Tapping "Predict now" on Home: (a) route to a league picker sheet, (b) route to the user's *primary* league for that competition (most recent / highest rank), or (c) predictions are per-league so we must pick one — recommend a lightweight sheet if >1 league, else direct. **Recommendation: direct if 1 league, sheet if >1.**
- **Q2 — Inline inputs vs pushed predict screen.** Keep the dedicated predict screen (recommended — it's the best screen) and have the league Predict pane *summarize + open it*, OR move score inputs inline into the pane. **Recommendation: keep pushed screen.**
- **Q3 — Account hero:** compact row vs de-weighted hero. **Recommendation: compact row.**
- **Q4 — Does "This week" progress count all leagues or per-competition?** **Recommendation: per-competition block shows that competition's leagues.**

---

## 7. Execution slices

Ordered; each independently shippable. Style everything with existing tokens (no palette/type work).

| ID | Slice | Scope | Key files | Acceptance |
|----|-------|-------|-----------|------------|
| **UXR1** | Actionable deadlines | Make `CountdownCard`/`DeadlineCard` tappable; open → predict route, closed → table route | `components/CountdownCard.tsx`, `(tabs)/index.tsx` | Tapping an open deadline on Home reaches predict in 1 tap |
| **UXR2** | Sticky league CTA | Extract `StickyActionBar`; pin "Make predictions" to league detail bottom | `components/`, `league/[id].tsx` | CTA reachable one-thumb from any pane |
| **UXR3** | 2-segment league + contextual default | Merge Fixtures into Predict; segments → `Predict · Table`; default pane by deadline state | `league/[id].tsx` | No Fixtures tab; open deadline lands on Predict |
| **UXR4** | "This week" Home block | New `ActionableDeadline` block with predicted/total status; demote leagues list | `components/`, `(tabs)/index.tsx`, `lib/queries` (progress) | Home shows how many leagues still need picks; leagues are secondary |
| **UXR5** | Focal hierarchy pass | One hero-weight region per screen; lighten the rest; document rule in headers | all post-login screens | Each screen has a single clear focal point |
| **UXR6** | Account hero de-weight | Compact profile row per Q3 | `(tabs)/account.tsx` | Settings screen no longer led by a heavy hero |
| **UXR7** | One-tap target routing | Contextual-default helper + league-picker sheet for multi-league competitions (Q1) | `lib/`, `(tabs)/index.tsx` | "Predict now" resolves correctly for 1 vs many leagues |

Suggested order: **UXR1 → UXR3 → UXR2 → UXR4 → UXR7 → UXR5 → UXR6.** (UXR1/UXR3 deliver the biggest depth win fastest; UXR5/UXR6 are polish.)

**Shipped:**
- **UXR1** (2026-07-17) — `CountdownCard` takes `onPress`/`actionLabel`; Home `DeadlineCard` routes an open deadline → predict (1 tap), a closed one → standings, with a league-picker `Sheet` when a competition has >1 league (resolves Q1: direct-if-1, sheet-if-many). Home is now 1 tap to predict.
- **UXR3** (2026-07-17) — league detail collapsed to `Predict · Table` (Fixtures folded into the Predict pane via `PredictOrFixtures`: your picks once predicted, else the fixtures list). Contextual default pane — Predict while the window's open, Table once closed, set once on load and locked by a manual tap. Resolves Q2 direction: the pushed predict screen stays the editor; this pane summarizes + links to it.
- **UXR2** (2026-07-17) — new `StickyActionBar` component (absorbs its own bottom safe-area inset); league detail pins a "Make predictions" / "View predictions" CTA to the bottom, visible from both panes. Inline pane button removed; SafeAreaView drops the bottom edge and the ScrollView flexes so the bar sits flush at the screen bottom. NOTE: `predict.tsx` still uses its own submit bar — folding it onto `StickyActionBar` is a deferred cleanup, not required for UXR2.
- **UXR4** (2026-07-17) — Home "Next deadlines" → **"This week"**, now personalised to the competitions the user actually plays (fixed PL→UCL order; section hidden when they have no leagues). New `useGameweekPredictionStatus` hook (via `useQueries`, sharing `usePredictions` cache keys) drives a per-competition status line on the `CountdownCard`: "Not predicted yet" / "N of M leagues predicted" / "All M leagues predicted ✓" while the window's open. Answers "what do I still need to do this week." (Leagues list left as the secondary section; finer focal-weight tuning is UXR5.)
- **UXR5** (2026-07-17) — focal rule codified in each post-login screen's header comment (Home, league detail, predict, account), so future edits don't re-flatten the hierarchy. One weight fix applied: Home greeting 30→26 so the navy "This week" cards (32px countdown) are the unrivaled hero. Deliberately light on visual churn — the depth work (UXR1–4) already resolved most of the "uniform / no focal point" feeling, and pixel-level weight tuning is best done with the app rendering in front of us rather than blind. Remaining focal polish folds into UXR6 (account) and any on-device pass.
- **UXR6** (2026-07-17) — Account navy hero replaced with a compact profile row (crest + name + @handle; dropped the leagues stat tile, which duplicates Home). Removes the over-weighted brand block from a low-frequency settings screen; the setting groups below now read as peers. Cleaned up newly-unused `brand`/`radius`/`DIM`/`useLeagues`.

**Effectively covered:**
- **UXR7** — one-tap routing was resolved inside UXR1 (direct-if-1-league, picker `Sheet` if many). No separate "primary league" heuristic added; the sheet is the disambiguation. Reopen only if users ask for a remembered default.

**Status: UXR1–6 shipped; UXR7 covered by UXR1. Rework complete pending an on-device focal/visual tuning pass with real renders.**

---

## 8. Explicitly NOT changing

- **Colors, fonts, tokens** — inherit `MOBILE_DESIGN_SPEC.md` untouched (this is the user's explicit constraint).
- **Component craft** — skeletons, empty states, haptics, pull-to-refresh, safe areas, the countdown hero visual, Table pane, the predict submit bar.
- **Backend / data model** — the "predicted/total" status is derived from existing `usePredictions`/`useLeagues`; no schema change.
- **Tab count** — stays at 2 (Leagues, Account). We fix depth, not the shell.
- **Auth flow** — out of scope; this rework is post-login only.

---

## 9. Sources

- [NN/g — Basic Patterns for Mobile Navigation](https://www.nngroup.com/articles/mobile-navigation-patterns/) — tab bars for ≤5 destinations; navigation hubs for task-focused sessions. [P-NAV]
- [NN/g — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) — show only what's needed now; defer the rest. [P-JTBD]
- [Apple HIG — Segmented Controls](https://developer.apple.com/design/human-interface-guidelines/segmented-controls) & [Tab Bars](https://developer.apple.com/design/human-interface-guidelines/tab-views) — segmented control = versions of one screen; ≤5 segments. [P-SEG]
- [Bottom Tab Bar Best Practices — UX Planet](https://uxplanet.org/bottom-tab-bar-design-best-practices-ef3ee71de0fc) — destinations not actions; 3–5 items. [P-NAV]
- [Designing for Thumb Zones (2025)](https://diversewebsitedesign.com.au/designing-for-thumb-zones-mobile-ux-in-2025/) — primary actions in the bottom third; ~49% one-handed. [P-THUMB]
- [Progressive Disclosure in Mobile UX — Digia](https://www.digia.tech/post/progressive-disclosure-mobile-ux/) — one dominant action per screen; defer non-essential. [P-HIER]
- [Jobs-to-be-Done for Dashboard Design](https://nastengraph.substack.com/p/jobs-to-be-done-a-user-centered-approach) — design for what the user is trying to accomplish, not the data you have. [P-JTBD]
