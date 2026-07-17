import { queryAll, queryOne, query } from "../db.js";

export const CURRENCIES = ["GBP", "USD", "JOD"] as const;
export type Currency = (typeof CURRENCIES)[number];

type PositionKey = "first" | "second" | "third" | "secondLast";

interface PrizePoolRow {
  id: string;
  currency: Currency;
  entryFeeMinor: number;
  pctFirst: number;
  pctSecond: number;
  pctThird: number;
  thirdMoneyBack: boolean;
  frozen: boolean;
  frozenAt: string | null;
  frozenMemberCount: number | null;
  frozenPoolMinor: number | null;
  createdAt: string;
}

// Per-position payouts (integer minor units), summing EXACTLY to the pool.
//  - Money-back positions — 2nd-last always, 3rd when `thirdMoneyBack` — each take
//    the entry fee off the top.
//  - The remainder is split among the percentage positions (1st, 2nd, and 3rd when
//    it is a %) by weight; rounding dust goes to 1st.
// A position is active only if that rank exists (2nd-last only at N >= 5); an
// inactive percentage weight is excluded from the denominator (renormalisation).
function computeAmounts(
  poolMinor: number,
  entryFeeMinor: number,
  weights: { first: number; second: number; third: number },
  thirdMoneyBack: boolean,
  n: number
): Partial<Record<PositionKey, number>> {
  const activeFirst = n >= 1;
  const activeSecond = n >= 2;
  const activeThird = n >= 3;
  const activeSecondLast = n >= 5;

  const amounts: Partial<Record<PositionKey, number>> = {};

  // Money-back positions each take the entry fee off the top.
  let moneyBackCount = 0;
  if (activeSecondLast) {
    amounts.secondLast = entryFeeMinor;
    moneyBackCount++;
  }
  if (activeThird && thirdMoneyBack) {
    amounts.third = entryFeeMinor;
    moneyBackCount++;
  }
  const moneyBackTotal = Math.min(poolMinor, entryFeeMinor * moneyBackCount);

  // The rest is split among the percentage positions.
  const remainder = Math.max(0, poolMinor - moneyBackTotal);
  const pctPositions: { key: PositionKey; w: number }[] = [];
  if (activeFirst) pctPositions.push({ key: "first", w: weights.first });
  if (activeSecond) pctPositions.push({ key: "second", w: weights.second });
  if (activeThird && !thirdMoneyBack) pctPositions.push({ key: "third", w: weights.third });

  const wsum = pctPositions.reduce((s, p) => s + p.w, 0);
  let assigned = 0;
  for (const p of pctPositions) {
    const amt = wsum > 0 ? Math.floor((remainder * p.w) / wsum) : 0;
    amounts[p.key] = amt;
    assigned += amt;
  }
  if (pctPositions.length > 0) {
    amounts.first = (amounts.first ?? 0) + (remainder - assigned);
  }
  return amounts;
}

// Ordered eligible member userIds, by the same criteria the leaderboard uses
// (points → exact scores → correct results, then joinedAt as a stable fallback).
// `eligibleBefore` (the freeze time) filters out post-freeze joiners; null = all.
async function orderedEligibleMembers(leagueId: string, eligibleBefore: string | null): Promise<string[]> {
  const rows = await queryAll<{ userId: string }>(
    `SELECT lm."userId"
       FROM league_member lm
       LEFT JOIN prediction p ON p."userId" = lm."userId" AND p."leagueId" = $1
      WHERE lm."leagueId" = $1
        AND ($2::timestamptz IS NULL OR lm."joinedAt" <= $2)
      GROUP BY lm."userId", lm."joinedAt"
      ORDER BY COALESCE(SUM(p.points), 0) DESC,
               COALESCE(SUM(CASE WHEN p.points = 3 THEN 1 ELSE 0 END), 0) DESC,
               COALESCE(SUM(CASE WHEN p.points = 1 THEN 1 ELSE 0 END), 0) DESC,
               lm."joinedAt" ASC`,
    [leagueId, eligibleBefore]
  );
  return rows.map((r) => r.userId);
}

// Freeze the pool at the first gameweek deadline (of the league's current-season
// competition) after the pool was created, once that deadline has passed. Freeze
// time = the deadline itself, so eligibility/count are exact regardless of when
// this read happens. Mutates + persists; returns the effective frozen state.
async function maybeFreeze(leagueId: string, pool: PrizePoolRow): Promise<void> {
  if (pool.frozen) return;
  const gw = await queryOne<{ deadline: string }>(
    `SELECT g.deadline
       FROM gameweek g
       JOIN season s ON g."seasonId" = s.id
       JOIN league l ON l.type = s.competition
      WHERE l.id = $1 AND s."isCurrent" = true AND g.deadline > $2
      ORDER BY g.deadline ASC
      LIMIT 1`,
    [leagueId, pool.createdAt]
  );
  if (!gw || new Date(gw.deadline) > new Date()) return;

  const count = await queryOne<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM league_member WHERE "leagueId" = $1 AND "joinedAt" <= $2`,
    [leagueId, gw.deadline]
  );
  const memberCount = count?.c ?? 0;
  const poolMinor = pool.entryFeeMinor * memberCount;
  await query(
    `UPDATE prize_pool
        SET frozen = true, "frozenAt" = $2, "frozenMemberCount" = $3, "frozenPoolMinor" = $4, "updatedAt" = now()
      WHERE id = $1`,
    [pool.id, gw.deadline, memberCount, poolMinor]
  );
  pool.frozen = true;
  pool.frozenAt = gw.deadline;
  pool.frozenMemberCount = memberCount;
  pool.frozenPoolMinor = poolMinor;
}

export interface PrizePoolPayload {
  currency: Currency;
  entryFeeMinor: number;
  pct: { first: number; second: number; third: number };
  // 2nd-last is always money-back; 3rd is money-back when this is true.
  thirdMoneyBack: boolean;
  frozen: boolean;
  poolMinor: number;
  memberCount: number;
  payouts: Record<PositionKey, { amountMinor: number; userId: string } | null>;
}

// The full prize-pool view for a league: config + live/frozen pool + per-position
// amounts and their current occupants. Returns null when the league has no pool.
export async function getPrizePoolPayload(leagueId: string): Promise<PrizePoolPayload | null> {
  const pool = await queryOne<PrizePoolRow>(
    `SELECT id, currency, "entryFeeMinor", "pctFirst", "pctSecond", "pctThird", "thirdMoneyBack",
            frozen, "frozenAt", "frozenMemberCount", "frozenPoolMinor", "createdAt"
       FROM prize_pool WHERE "leagueId" = $1`,
    [leagueId]
  );
  if (!pool) return null;

  await maybeFreeze(leagueId, pool);

  const ordered = await orderedEligibleMembers(leagueId, pool.frozen ? pool.frozenAt : null);
  const n = ordered.length;
  const poolMinor = pool.frozen ? pool.frozenPoolMinor ?? 0 : pool.entryFeeMinor * n;

  const pct = { first: pool.pctFirst, second: pool.pctSecond, third: pool.pctThird };
  const amounts = computeAmounts(poolMinor, pool.entryFeeMinor, pct, pool.thirdMoneyBack, n);

  const payoutAt = (key: PositionKey, idx: number) => {
    const amt = amounts[key];
    if (amt === undefined || idx < 0 || idx >= n) return null;
    return { amountMinor: amt, userId: ordered[idx]! };
  };

  return {
    currency: pool.currency,
    entryFeeMinor: pool.entryFeeMinor,
    pct,
    thirdMoneyBack: pool.thirdMoneyBack,
    frozen: pool.frozen,
    poolMinor,
    memberCount: n,
    payouts: {
      first: payoutAt("first", 0),
      second: payoutAt("second", 1),
      third: payoutAt("third", 2),
      secondLast: payoutAt("secondLast", n - 2),
    },
  };
}

export interface ValidatedPrizePool {
  currency: Currency;
  entryFeeMinor: number;
  pctFirst: number;
  pctSecond: number;
  pctThird: number;
  thirdMoneyBack: boolean;
}

// Validate an admin's prize-pool input. 2nd-last is always money-back (no %). The
// percentage positions must sum to 100: 1st+2nd+3rd, or 1st+2nd when 3rd is
// money-back. Returns the normalised row values, or an { error } for a 400.
export function validatePrizePoolInput(body: unknown): ValidatedPrizePool | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const currency = b.currency as Currency;
  const entryFeeMinor = b.entryFeeMinor as number;
  const thirdMoneyBack = b.thirdMoneyBack === true;
  const pct = (b.pct ?? {}) as Record<string, unknown>;

  if (!CURRENCIES.includes(currency)) return { error: "currency must be GBP, USD, or JOD" };
  if (!Number.isInteger(entryFeeMinor) || entryFeeMinor <= 0) {
    return { error: "entryFeeMinor must be a positive integer (minor units)" };
  }
  const first = pct.first as number;
  const second = pct.second as number;
  const third = (thirdMoneyBack ? 0 : pct.third) as number;
  for (const [k, v] of [["first", first], ["second", second], ["third", third]] as const) {
    if (!Number.isInteger(v) || v < 0 || v > 100) return { error: `pct.${k} must be an integer 0-100` };
  }

  if (thirdMoneyBack) {
    if (first + second !== 100) return { error: "1st + 2nd must total 100%" };
    if (!(first >= second)) return { error: "1st must pay at least as much as 2nd" };
  } else {
    if (first + second + third !== 100) return { error: "1st + 2nd + 3rd must total 100%" };
    if (!(first >= second && second >= third)) return { error: "percentages must be non-increasing (1st ≥ 2nd ≥ 3rd)" };
  }

  return { currency, entryFeeMinor, pctFirst: first, pctSecond: second, pctThird: third, thirdMoneyBack };
}
