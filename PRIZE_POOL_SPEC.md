# ScoreCast — Prize Pool Spec (PP1)

**Status:** Written 2026-07-17. Slices `PP1a–PP1e` below.
**Parents:** `MOBILE_DESIGN_SPEC.md` (tokens/components), league detail (`src/app/league/[id].tsx`), leaderboard (`src/lib/queries/leaderboard.ts`, `LeaderboardRow`).
**Nature:** **Display-only.** The app computes and shows who's owed what; it moves **no money**. Framing is a "stakes tracker," not a betting product (App Store safety).

Intent in one line: **the admin sets a per-head entry fee + currency; the app shows a live prize pool and paints each paid position's cut onto that player's leaderboard row.**

---

## 1. Decisions (locked)

| # | Decision |
|---|---|
| Money | **Display-only.** No collection/disbursement. Settle offline. |
| Split | **Percentage-based, admin-adjustable.** Four weights that must sum to 100 and be non-increasing (1st ≥ 2nd ≥ 3rd ≥ 2nd-last). |
| Default split | **50 / 25 / 15 / 10** ("break-even-flavoured" — 2nd-last ≈ money-back around N=10; small loss below, small profit above). Chose the percentage model over literal break-even because literal break-even inverts order at N=5–7 (3rd < 2nd-last). |
| Paid positions | 1st, 2nd, 3rd, and **2nd-last (rank N−1)**. Last place gets nothing. |
| 2nd-last unlock | **N ≥ 5** only (so rank N−1 is distinct from the podium). Below 5 → top-3 only, weights renormalised. |
| Currency | Admin picks **GBP / USD / JOD**. Precision per currency: **GBP/USD 2dp, JOD 3dp** (JOD = 1000 fils). Money stored/computed in **integer minor units**. |
| Rounding | Each payout = `floor(pool × weight / Σactiveweights)` in minor units; **remainder (dust) → 1st place** so payouts sum *exactly* to the pool. |
| Pool lifecycle | **Live (provisional)** = `entryFee × current member count` until the **first prediction deadline after the pool is created** ("GW1"), then **frozen**: member count, pool total, and eligible-member set are fixed. |
| Late joiners | Members who join **after** the freeze **play but are not in the pool** — no entry counted, not prize-eligible, no badge. *(Assumed from recommendation — veto if wrong.)* |
| Ties | v1 uses the **existing leaderboard order** (points → exact scores → correct results) to rank paid positions. The "held-the-higher-position-longest" tiebreaker is **deferred** to PP-later (needs per-gameweek rank history; only bites on end-of-season dead-heats). *(Assumed — veto if you want it in v1.)* |

---

## 2. Data model

New migration **`012_prize_pool`**. One optional pool per league.

```sql
CREATE TABLE prize_pool (
  id               TEXT PRIMARY KEY,
  "leagueId"       TEXT NOT NULL UNIQUE REFERENCES league(id) ON DELETE CASCADE,
  currency         TEXT NOT NULL CHECK (currency IN ('GBP','USD','JOD')),
  "entryFeeMinor"  INTEGER NOT NULL CHECK ("entryFeeMinor" > 0),  -- pence/cents/fils
  "pctFirst"       INTEGER NOT NULL DEFAULT 50,
  "pctSecond"      INTEGER NOT NULL DEFAULT 25,
  "pctThird"       INTEGER NOT NULL DEFAULT 15,
  "pctSecondLast"  INTEGER NOT NULL DEFAULT 10,
  frozen           BOOLEAN NOT NULL DEFAULT false,
  "frozenAt"       TIMESTAMPTZ,
  "frozenMemberCount" INTEGER,
  "frozenPoolMinor"   INTEGER,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ("pctFirst" + "pctSecond" + "pctThird" + "pctSecondLast" = 100),
  CHECK ("pctFirst" >= "pctSecond" AND "pctSecond" >= "pctThird" AND "pctThird" >= "pctSecondLast")
);
```

**Eligibility without a join table:** a member is prize-eligible iff `league_member."joinedAt" <= prize_pool."frozenAt"` (or, before freeze, all members). No separate participant table needed. A pre-freeze member who later leaves is simply absent from the table; `frozenPoolMinor` still stands (their buy-in stays in the pot narratively).

Register `up` in `db.ts` after `predictionHiddenMigration`.

---

## 3. Payout math (server = single source of truth)

Given pool `P` (minor units), member count `N`, weights `w = {first, second, third, secondLast}`:

1. **Active positions:**
   - `first, second, third` active when `N ≥ 3`, `≥ 2`, `≥ 3` respectively (i.e. only if that rank exists).
   - `secondLast` active only when **N ≥ 5**.
   - For `N < 5`, secondLast is dropped and its weight is *excluded* (not reassigned by hand — see step 2, which divides by the active-weight sum).
2. **Amount per active position `i`:** `amountᵢ = floor(P × wᵢ / Σ(active w))`.
3. **Dust:** `P − Σ amountᵢ` is added to `first`. Guarantees `Σ = P`.
4. **Occupant:** map each active position to a **userId** from the eligible-member leaderboard order — rank 1 → first, 2 → second, 3 → third, **N−1 → secondLast**. Positions with no occupant (empty league) return `null`.

**Worked examples**

- **JOD, E=5.000 (5000 fils), N=10, frozen.** P=50000. Weights 50/25/15/10 (Σ=100).
  1st 25000, 2nd 12500, 3rd 7500, 2nd-last **5000** → *exactly money-back*. Display: 25.000 / 12.500 / 7.500 / 5.000 JD.
- **GBP, E=£5 (500p), N=8.** P=4000p. 1st £20.00, 2nd £10.00, 3rd £6.00, 2nd-last **£4.00** (80% back — small consolation loss at 8 players).
- **USD, E=$5, N=4 (2nd-last inactive).** Active weights 50/25/15 (Σ=90). P=2000¢.
  1st `floor(2000×50/90)=1111`, 2nd `555`, 3rd `333` → Σ=1999, dust 1¢ → 1st `1112`. → $11.12 / $5.55 / $3.33.

---

## 4. API

All under the existing leagues router; admin checks reuse `isAdmin`.

- **`GET /api/leagues/:leagueId/prize-pool`** → the pool + computed payouts, or `204`/`null` if none:
  ```jsonc
  {
    "currency": "GBP",
    "entryFeeMinor": 500,
    "pct": { "first":50, "second":25, "third":15, "secondLast":10 },
    "frozen": true,
    "poolMinor": 4000,
    "memberCount": 8,            // eligible N
    "payouts": {
      "first":      { "amountMinor": 2000, "userId": "u1" },
      "second":     { "amountMinor": 1000, "userId": "u2" },
      "third":      { "amountMinor": 600,  "userId": "u3" },
      "secondLast": { "amountMinor": 400,  "userId": "u7" }   // null if N<5
    }
  }
  ```
  Server computes payouts + occupants over **eligible members ranked by the existing leaderboard function** (reuse it; filter to eligible userIds).
- **`PUT /api/leagues/:leagueId/prize-pool`** (admin, blocked once `frozen`) — upsert `{ currency, entryFeeMinor, pct{...} }`. Validates sum=100, non-increasing, entryFee>0.
- **`DELETE /api/leagues/:leagueId/prize-pool`** (admin, blocked once `frozen`).

**Freeze mechanism:** on serving `GET`, if `!frozen` and `now ≥ firstDeadlineAfter(createdAt)`, freeze lazily — set `frozen`, `frozenAt`, `frozenMemberCount = count(league_member)`, `frozenPoolMinor = entryFeeMinor × count`. (If a deadline-processing job already exists, hook the freeze there instead for exactness; lazy-on-read has a small gap where someone joining between the deadline and the first read could be miscounted — acceptable for display, note in code.)

---

## 5. Client

- **`usePrizePool(leagueId)`** hook (`src/lib/queries/prizePool.ts`) → the shape above (or `null`). `staleTime` ~30s; invalidate on admin edit and on leaderboard refresh.
- **Currency util** (`src/utils/money.ts`): `formatMoney(amountMinor, currency)` → `"£20.00"`, `"$11.12"`, `"20.000 JD"` (JOD suffixed, 3dp; GBP/USD prefixed, 2dp). Plus `minorPerUnit(currency)` and a parse helper for the fee input.
- **Prize pool card** (`components/PrizePoolCard.tsx`) — rendered at the **top of the Table pane** in `league/[id].tsx`. Shows: total pool, `entryFee × N`, currency, four position payouts (labelled 1st/2nd/3rd/2nd-last), and a state line — `Provisional · locks when GW1 starts` (before freeze) or `Final` (after). Hidden entirely if the league has no pool.
- **Name-card badge** — `LeaderboardRow` gains optional `prize?: { amountMinor, currency }`. In `TablePane`, map each entry's `userId` against `payouts.{first,second,third,secondLast}.userId` and pass the amount. Renders a compact currency pill on the row (trailing edge, near points). Live — moves as standings move.

---

## 6. Admin setup flow

- **Create league** (`league/create.tsx`): optional **"Prize pool"** section — a toggle to enable, then currency segmented control (£/$/JOD), entry-fee input (precision + symbol follow the currency), and a collapsed **"Advanced: prize split"** defaulting to 50/25/15/10 with four steppers/inputs and a live "must total 100%" validator + non-increasing check.
- **Manage league** (`league/manage.tsx`): same editor, **editable until frozen**; after freeze it's read-only (shows the final pool + split with a "locked at GW1" note).
- Guardrails surfaced in UI: "2nd-last prize unlocks at 5 players"; the sum/order validators block save.

---

## 7. Execution slices

| ID | Slice | Scope |
|----|-------|-------|
| **PP1a** | Backend | `012_prize_pool` migration; GET/PUT/DELETE endpoints; payout+occupant computation reusing the leaderboard; lazy freeze; tests (math, N<5 renorm, dust, freeze, eligibility, non-admin blocked). |
| **PP1b** | Money util + hook | `formatMoney`/parse per currency; `usePrizePool`. |
| **PP1c** | Prize pool card | `PrizePoolCard` at the top of the Table pane; provisional/final states; hidden when no pool. |
| **PP1d** | Name-card badges | `LeaderboardRow` prize pill; `TablePane` maps occupants → amounts. |
| **PP1e** | Admin setup | Prize-pool section in create + manage (currency, fee, split editor, validators, frozen read-only). |

Order: **PP1a → PP1b → PP1c/PP1d → PP1e.** PP1a is the contract; everything else consumes it.

---

## 8. Deferred / open

- **Position-history tiebreaker** ("held the higher position the longest"). Needs a `rank_history` table snapshotting each member's rank per scored gameweek, then a head-to-head-over-time comparison for final-standings dead-heats. Only matters at season end when points *and* exact-scores are tied. Deferred to a fast-follow (`PP2`). Until then, ties resolve by the existing leaderboard order.
- **Real money** — out of scope, likely permanently (regulatory/App Store). If ever revisited it's a separate product.
- **Multiple pools / per-gameweek prizes** — not in scope; one season-long pool per league.
