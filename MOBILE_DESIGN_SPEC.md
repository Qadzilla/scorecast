# ScoreCast Mobile — Design Spec (PS1)

**Status:** Written 2026-07-15 (slice PS1). Child slices `DS1–DS9` registered in `MOBILE_SLICES.md`.
**Parents:** `MOBILE_PLAN.md` §6 (tokens + rules, decisions locked: unified light theme) and §5.4 (screen inventory). This doc turns those into a buildable visual spec: final tokens, per-component anatomy and states, per-screen layouts, icon direction — and ends in the `DS*` slice table that MOBILE_SLICES.md tracks.

Design intent in one line: **a light, calm scoreboard** — white cards on cool slate, Plus Jakarta Sans, with each league's identity (PL purple / UCL navy) doing the accenting and green reserved for success and action.

---

## 1. Principles

1. **Competition color is the theme.** Screens scoped to a league take their accent from `leagueType` (PL purple / UCL navy). Global surfaces (auth, home, account) use neutral slate + brand green actions. Never mix both competition colors in one composition except the home screen's two countdown cards.
2. **White carries content, background carries nothing.** `bg` is atmosphere; every piece of information sits on a `surface` card or row. No borders where a shadow + spacing suffices.
3. **Numbers are the product.** Scores, countdowns, points, ranks always use tabular figures, weighted Bold+, and get the largest type on any screen.
4. **One accent per element.** A card may tint its rail, its badge, or its button — not all three.
5. **States are designed, not defaulted.** Every list has loading (skeleton), empty (illustrated line + CTA), error (Banner + retry); every input has focus/error; anything deadline-driven has locked/finished forms. No spinner-only screens after first paint except full-screen boot.

## 2. Tokens (final — `mobile/src/constants/theme.ts`)

### 2.1 Color

```ts
colors = {
  bg:            "#f1f5f9",  // screen background (flat)
  surface:       "#ffffff",  // cards, sheets, tab bar
  surfaceAlt:    "#f8fafc",  // inset rows, filled inputs, skeleton base
  border:        "#e2e8f0",  // hairlines, input borders (default state)
  textPrimary:   "#0f172a",
  textSecondary: "#64748b",
  textTertiary:  "#94a3b8",  // placeholders, timestamps
  textOnBrand:   "#ffffff",

  plPurple:      "#3d195b",
  plPurpleLight: "#6b2d8a",  // gradients-with-plPurple, pressed states
  plTint:        "#f3eef8",  // pl-scoped fills: active segment bg, rail tints
  uclNavy:       "#04065c",
  uclNavyLight:  "#1a237e",
  uclTint:       "#e9eaf6",

  accent:        "#00b368",  // CTAs, success, exact-score. (#00ff87 fails
  accentPressed: "#009457",  //  contrast on white — decorative use only,
  accentTint:    "#e6f7ef",  //  on purple/navy surfaces, never text/fills)
  danger:        "#dc2626",  dangerTint:  "#fdecec",
  warning:       "#d97706",  warningTint: "#fdf3e3",
}
```

Rule of use: `*Tint` fills always pair with their full-strength color as text/icon — never tint-on-tint.

### 2.2 Typography (Plus Jakarta Sans everywhere)

| Style | Weight / size / line | Use |
|---|---|---|
| `display` | ExtraBold 28/34 | Screen titles (home greeting, league name) |
| `title` | Bold 22/28 | Card titles, sheet headers, big stats |
| `heading` | SemiBold 17/24 | Section headers, list item primaries |
| `body` | Regular 15/22 | Default text |
| `bodyMedium` | Medium 15/22 | Emphasized body, button-secondary labels |
| `caption` | Regular 13/18 | Metadata, helper text, timestamps |
| `label` | SemiBold 11/14, +0.6 tracking, UPPERCASE | Overlines: "PREMIER LEAGUE", "DEADLINE" |
| `numeral` | Bold 24/28, `fontVariant: ["tabular-nums"]` | Score inputs, countdown digits |
| `numeralLg` | ExtraBold 34/38, tabular | Hero countdown, account stat tiles |

Dynamic Type: respect OS font scaling up to the XL step, then clamp (`maxFontSizeMultiplier={1.4}` globally) — layouts must survive 1.4×.

### 2.3 Geometry, elevation, motion, haptics

- **Spacing scale:** 4 / 8 / 12 / 16 / 20 / 24 / 32. Screen gutter 20. Card padding 16. List row height ≥ 56.
- **Radius:** 10 (inputs, small chips) / 14 (cards, buttons) / 20 (sheets, hero cards) / pill (badges).
- **Shadow (single, everywhere):** iOS `shadowColor #0f172a, opacity 0.06, radius 12, offset (0,4)`. No blur effects anywhere in the app.
- **Motion:** 150ms ease-out for presses/segment changes; 250ms spring for sheets. Countdown digits never animate (they tick, tabular keeps them still). Respect Reduce Motion (disable springs → fades).
- **Haptics map (`expo-haptics`):** selection-changed = segment/team pick; light impact = score digit entered; success notification = predictions submitted, league joined; warning = destructive confirm shown. Nothing else — haptics are punctuation, not narration.
- **Icons:** `@expo/vector-icons` **Ionicons** (cross-platform safe for the later Android pass). Tab bar: `trophy` / `trophy-outline`, `person-circle` / `-outline`. Standard sizes 20 (inline) / 24 (nav).

## 3. Component specs (§6.3 inventory, complete)

Every component lives in `mobile/src/components/`, is demoed in the dev gallery route (`app/_gallery.tsx`, dev-only) in **all** states listed, and takes tokens only — no literal colors in component files.

**Button** — height 52 (44 compact), radius 14, `bodyMedium` label.
Variants: *primary* (accent fill, white label; pressed `accentPressed`), *brand* (competition color fill when league-scoped), *secondary* (surface, 1px border, textPrimary), *destructive* (danger fill), *ghost* (no fill, accent label).
States: default / pressed (fill shift + 0.98 scale) / disabled (40% opacity) / loading (spinner replaces label, width locked).

**TextField** — filled `surfaceAlt`, radius 10, 1px `border`; focus: 2px competition-or-accent border; error: 2px danger + caption error line below; label above in `caption` SemiBold. Height 52. RHF-wired (`Controller`).

**Card** — surface, radius 14, padding 16, shadow. Optional 4pt left **rail** (competition color) and `onPress` (pressed = `surfaceAlt`).

**ScreenHeader** — 44pt row: back chevron (44×44 target), `heading` title centered or `display` left-aligned large variant; optional right action. Transparent over `bg`.

**SegmentedControl** — full-width, `surfaceAlt` track (radius 12), active segment: white pill, competition-color `bodyMedium` label, shadow; inactive: `textSecondary`. 150ms slide. Selection haptic.

**CountdownCard** — Card with rail. Overline `label` competition name; `numeralLg` `DD : HH : MM : SS` with `caption` unit labels under groups; footer `caption` = gameweek name + absolute deadline. States: normal / <24h (rail & digits `warning`) / <1h (`danger`) / passed ("Deadline passed — GW locked", digits replaced) / gameweek-live ("Matches in play") / loading (skeleton bars).

**MatchRow** — 56pt: home crest 28 + name (`body`, truncate mid) → center cell → away name + crest. Center: kickoff `HH:MM` (`bodyMedium`) before; **score chip** (`numeral` 17pt, `surfaceAlt` pill) after start; live = accent dot prefix. Red cards: 8pt red square with count beside crest. Finished + user-predicted rows append a PointsBadge.

**ScoreInput** — 48×56, radius 10, centered `numeral`; same border behavior as TextField; auto-advance home→away→next row; backspace steps back; `inputMode="numeric"`, regex `^\d$`. Locked state: `surfaceAlt` fill, `textTertiary` digit, small lock glyph between the pair. Empty-at-deadline shows "–".

**PointsBadge** — pill 24pt height, `caption` Bold: exact = accent fill/white "3 pts"; result = `accentTint` fill/accent text "1 pt"; miss = `surfaceAlt`/`textTertiary` "0 pts"; pending (match live) = `warningTint`/warning "…".

**TeamCrest** — expo-image, sizes 24/28/40/64, `contentFit="contain"`, 2px padding on white circle when over colored surfaces; fallback = initials disc in competition tint; `accessibilityLabel` = team name. (SVG capability verified in DS4 against real crest URLs.)

**LeaderboardRow** — rank (`numeral` 17pt, width 32) / avatar-initials disc 32 / username `bodyMedium` (+ "You" chip in accentTint) / points `numeral` right. Top-3 ranks get competition-color text. Own row: `plTint`/`uclTint` background. Champion state (season complete): gold `#d97706` trophy prefix on rank 1.

**EmptyState** — centered in remaining space: Ionicon 48 `textTertiary`, `heading` one-liner, `caption` sub-line, optional primary Button. Copy per surface defined in screen specs.

**Sheet** — bottom sheet, surface, radius 20 top, grab handle, `title` header; max 85% height, content scrolls. Used for: rules, league info, team change, destructive confirms that need content (else `Alert.alert`).

**StatTile** — `surfaceAlt` tile radius 14, padding 12: `numeralLg` value + `caption` label ("Total pts", "Best GW", "Leagues"). Loading = skeleton.

**Banner** — inline strip radius 10, tint fill + full-strength icon/text (`caption`): error (danger, with "Retry" ghost button slot), offline ("You're offline — showing saved data"), success (auto-dismiss 3s), info. Slides under the header.

**Skeleton** (implicit primitive) — `surfaceAlt` blocks, 1.2s opacity pulse; every list screen defines its skeleton as rows of its real component shapes.

## 4. Screen specs (§5.4 inventory, complete)

Common: `SafeAreaView` edges top+bottom on stacks, top on tabs; screen bg `bg`; gutter 20; scroll content bottom-padded 32. Query error on cold cache → full EmptyState-with-retry; error with cached data → Banner over stale content.

### 4.1 `(auth)/login`
Vertical: logo lockup (wordmark "ScoreCast" `display`, "Score" textPrimary + "Cast" in a plPurple→uclNavy gradient mask; `caption` tagline "Premier League & UCL predictions") at ~18% top inset → TextField *Username or email* → TextField *Password* (secure, reveal toggle) → primary Button **Log in** → ghost Button "New here? **Create an account**". KeyboardAvoiding; return-key chains fields then submits.
States: submitting (button loading, fields disabled); invalid credentials (Banner error "Wrong username or password"); 429 (Banner "Too many attempts — try again in 15 minutes"); offline (Banner).

### 4.2 `(auth)/signup`
ScreenHeader (back). Fields: First name / Last name (side-by-side 50/50), Username (prefix "@" glyph, lowercase keyboard, availability error on submit 409), Email, Password (+ live helper `caption` showing the 8–128 rule), Confirm. Primary Button **Create account** pinned above keyboard. Inline Zod errors under each field on blur. "Account exists" error under Email with ghost link → login.

### 4.3 `(auth)/verify`
Centered: Ionicon `mail-unread-outline` 48 accent → `title` "Check your email" → `body` "We sent a 6-digit code to **{email}**" → six ScoreInput-style boxes (40×52, gap 8, auto-advance, paste distributes, `textContentType="oneTimeCode"`) → auto-submits on 6th digit → ghost Button "Resend code" with countdown suffix "(0:47)".
States: verifying (boxes disabled, spinner below); wrong code (boxes flash danger border + shake unless Reduce Motion, then clear); expired (Banner + auto-focus resend); success (brief accent check, then route).

### 4.4 `(auth)/team-select`
`display` "Pick your team" + `caption` "Shown on your profile — you can change it anytime". Selected-team preview Card (crest 64 + name `title`) collapses when empty. FlatList grid 3-col of crest cells (crest 40 + `caption` shortName, cell radius 14, selected = 2px accent border + accentTint). Primary Button **Continue** pinned bottom, disabled until selection. Selection haptic per tap.
States: loading (grid skeleton), error (EmptyState + retry), saving (button loading).

### 4.5 `(tabs)` shell
Native tab bar, surface bg, hairline top border; active tint follows nothing league-scoped — accent green; `Leagues` (trophy) + `Account` (person-circle). Badge dot on Leagues when any deadline < 24h.

### 4.6 `(tabs)/index` — Leagues home
Header block: `caption` date + `display` "Hey {firstName}" + favorite-crest 40 right. Then **two CountdownCards** (PL, UCL — the one exception to one-competition-per-screen). Then `heading` "Your leagues" + league Cards: rail = competition, name `heading`, member count `caption`, right column rank `numeral` ("2nd" via `formatRank`) + pts `caption`. Pull-to-refresh.
States: skeleton (2 countdown + 2 league card shapes); no leagues (EmptyState: trophy icon, "No leagues yet", "Ask your league admin for an invite code", Button **Join a league**); offline Banner.

### 4.7 `league/[id]` — League detail
ScreenHeader: league name, right `ellipsis-horizontal` → sheet (League info: invite code row with copy icon + success haptic/toast, member count, type; admin-only: Rename, Manage members). Below: SegmentedControl **Fixtures / Predictions / Table** (competition-colored active).
- **Fixtures:** day sections (`label` date headers) of MatchRows. Empty (no active GW): EmptyState "No fixtures right now".
- **Predictions:** deadline strip (compact CountdownCard) → if open: user's current picks as MatchRows with editable ScoreInputs inline **preview** (read-only summary) + primary full-width Button **Make predictions** / **Edit predictions** → 4.8; if passed: locked rows; if finished: rows + PointsBadges + GW total Card ("GW22 — 9 pts").
- **Table:** LeaderboardRows (full standings), own row highlighted, sticky header row (`label` Rank/Player/Pts). Season complete → champion treatment + Banner "Final standings".
All three panes share one skeleton pattern (rows).

### 4.8 `league/[id]/predict`
ScreenHeader "GW{n} predictions" + deadline `caption` under title (warning/danger colored per threshold). Scroll of day sections; each match: MatchRow layout with two ScoreInputs replacing the center cell. Sticky bottom bar (surface, top hairline): `caption` "7/10 entered" + primary Button **Submit predictions** (disabled at 0; partial entry allowed — server accepts subsets).
States: submitting (bar button loading); success (success haptic + toast Banner, pop back to Predictions pane); deadline-passed 400 (danger Banner "Deadline has passed", inputs lock, auto-refresh); conflict-free reopen (existing predictions prefill).

### 4.9 `(tabs)/account`
Profile Card: initials/crest avatar 64, name `title`, "@username" `caption`, favorite-team chip. StatTile row ×3 (Total pts / Best GW / Leagues — computed from leaderboard endpoints). Section list (Cards of 56pt rows, chevron right): Edit username (inline sheet w/ TextField + 409 error) · Change favorite team (sheet grid reusing 4.4's cells) · Notifications (toggles; disabled + `caption` "Coming with the next update" until `NS*` lands) · Account info (static rows: name, email + verified check) · **Log out** (ghost, confirm Alert) · **Delete account** (destructive row; flow: Alert #1 → Sheet with `body` consequence copy + TextField requiring the literal word "DELETE" + destructive Button; then sign-out).
Danger section visually separated (24 gap + `label` "DANGER ZONE" in danger).

### 4.10 `league/join` (modal)
Sheet-style modal: `title` "Join a league", `body` helper, single TextField (monospaced-feel: `numeral` 17, `autoCapitalize="characters"`, maxLength 8, letter-spacing 2), primary Button **Join**.
States: 404 (field error "That code doesn't match any league"); already-member 400 (info Banner + ghost "Open league" link); success (success haptic, dismiss, navigate to the league).

### 4.11 `league/create` (modal, admin-only)
TextField name + competition picker (two large selectable Cards: PL / UCL with tint+rail selection) + primary **Create league**. Success state *within the modal*: invite code displayed `numeralLg` centered in a dashed-border Card + Button **Copy code** + ghost **Done**.

### 4.12 `league/[id]/members` (admin-only)
List of LeaderboardRow-like member rows (avatar, username, joined date `caption`, role chip) with `remove-circle-outline` action (44pt target) → `Alert.alert` destructive confirm → optimistic removal + error rollback Banner. Creator/self shows no remove action.

## 5. App icon & splash — direction (executed in DS8)

- **Icon:** rounded-square field, diagonal gradient plPurple → uclNavy (the two-competition identity), centered white ExtraBold "S" cut with a subtle upward **scoreline notch** (the "cast" — a 2-point polyline reading as both a graph tick and a ✓), rendered in `#00ff87` (neon lives here happily — dark ground). No wordmark, no ball clichés. Test at 29pt–1024pt; the notch must survive 29pt or be dropped at small sizes.
- Alternates to comp in DS8: (a) "S" only, no notch; (b) split-field purple/navy with white "SC" monogram. Pick by squint test on a real home screen.
- **Splash:** flat `#f1f5f9`, centered icon mark 96pt. No text, no gradient background (Expo splash is static; keep it instant-feeling).

## 6. Accessibility checklist (enforced from DS2 on, audited in DS9)

- Text contrast ≥ 4.5:1 on its actual surface (tints verified: full-strength-on-tint combinations above all pass; never `textTertiary` under 13pt).
- Touch targets ≥ 44×44 (icon buttons get invisible hit-slop).
- Every interactive element: `accessibilityRole` + label; crests and badges get text labels; countdowns expose an accessible summary string ("2 days 4 hours until deadline"), not digit-by-digit.
- Dynamic Type to 1.4× without truncating numerals; VoiceOver order = visual order; Reduce Motion honored (§2.3).

---

## 7. `DS*` slice table (registered in MOBILE_SLICES.md)

Same conventions as MOBILE_SLICES.md: one commit each, verifiable exits. DS1 lands inside MS7's scaffold work; DS2–DS4 are the concrete cut of MS8; DS5–DS7 are visual passes that follow the corresponding functional stages; DS8–DS9 gate TestFlight.

| Slice | Title | Contents | Lands with | Exit criterion |
|---|---|---|---|---|
| DS1 | Foundations | `theme.ts` (all §2 tokens), font loading, Skeleton primitive, haptics util, Ionicons wiring | MS7 (Stage B) | Gallery route renders token sheet: full palette swatches, all 9 type styles, spacing/radius/shadow samples, in-app on simulator |
| DS2 | Form & feedback primitives | Button (5 variants × 4 states), TextField, Banner (4 kinds), EmptyState, Sheet | MS8 (Stage B) | Each in gallery in every §3 state; a11y labels + 44pt targets verified |
| DS3 | Layout primitives | Card (+rail/pressable), ScreenHeader (2 variants), SegmentedControl, StatTile | MS8 (Stage B) | Gallery-complete incl. pressed/loading states; segment slide at 150ms; selection haptic fires |
| DS4 | Domain components | TeamCrest (SVG verification vs ≥5 real crest URLs), CountdownCard (6 states), MatchRow (all match states), ScoreInput (incl. auto-advance chain), PointsBadge (4), LeaderboardRow (incl. champion) | MS8 (Stage B) | Gallery-complete; crest fallback path demonstrated; countdown ticks without layout jitter (tabular verified) |
| DS5 | Auth & onboarding visual pass | Apply §4.1–4.4 layouts/states to the functional screens from MS9–MS11 (lockup gradient mask, verify-code interactions, team grid selection) | end of Stage C | Side-by-side screenshot review vs spec; all listed states reachable and styled (bad code shake, resend countdown, etc.) |
| DS6 | Core screens visual pass | Apply §4.5–4.7 + 4.10–4.12 to MS12–MS14 output (tab badge dot, league rails, segmented panes, sheets, join/create/members states) | end of Stage D | Screenshot review vs spec; every state listed in §4.6–4.7/4.10–4.12 reachable and styled |
| DS7 | Predictions & account visual pass | Apply §4.8–4.9 to MS15–MS16 (sticky submit bar, locked/finished rows, danger zone, delete flow styling) | end of Stage D | Screenshot review vs spec; deadline warning/danger thresholds demonstrated with a near-deadline GW |
| DS8 | App icon + splash | Execute §5: produce icon comps, squint-test, finalize 1024 master + splash, wire `app.json` | Stage F, before MS17 | Icon renders on a physical device home screen + TestFlight listing; splash → first paint with no flash-of-wrong-background |
| DS9 | Motion, haptics & a11y audit | Sweep §2.3 haptics map + §6 checklist across all screens; Reduce Motion + Dynamic Type 1.4× pass; fix violations | Stage F, before MS17 | VoiceOver walkthrough of the core loop (login → predict → table) completes sensibly; contrast + target audit checklist all ticked |

**Cross-registration note:** MS8's own exit criterion in MOBILE_SLICES.md is satisfied exactly by DS2+DS3+DS4 completing. If a DS slice discovers a spec error here, amend this file in the same commit (this spec is living; the tokens in §2 are the contract).
