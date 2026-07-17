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
  pctSecondLast: number;
  frozen: boolean;
  frozenAt: string | null;
  frozenMemberCount: number | null;
  frozenPoolMinor: number | null;
  createdAt: string;
}

// Split the pool across the active positions in integer minor units, handing the
// rounding remainder ("dust") to 1st so the payouts sum EXACTLY to the pool.
// A position is active only if that rank exists (and 2nd-last only at N >= 5); an
// inactive position's weight is excluded from the denominator (renormalisation).
function splitPool(
  poolMinor: number,
  weights: Record<PositionKey, number>,
  n: number
): Partial<Record<PositionKey, number>> {
  const active: { key: PositionKey; w: number }[] = [];
  if (n >= 1) active.push({ key: "first", w: weights.first });
  if (n >= 2) active.push({ key: "second", w: weights.second });
  if (n >= 3) active.push({ key: "third", w: weights.third });
  if (n >= 5) active.push({ key: "secondLast", w: weights.secondLast });

  const wsum = active.reduce((s, a) => s + a.w, 0);
  const amounts: Partial<Record<PositionKey, number>> = {};
  let assigned = 0;
  for (const a of active) {
    const amt = wsum > 0 ? Math.floor((poolMinor * a.w) / wsum) : 0;
    amounts[a.key] = amt;
    assigned += amt;
  }
  if (active.length > 0) {
    amounts.first = (amounts.first ?? 0) + (poolMinor - assigned);
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
  pct: Record<PositionKey, number>;
  frozen: boolean;
  poolMinor: number;
  memberCount: number;
  payouts: Record<PositionKey, { amountMinor: number; userId: string } | null>;
}

// The full prize-pool view for a league: config + live/frozen pool + per-position
// amounts and their current occupants. Returns null when the league has no pool.
export async function getPrizePoolPayload(leagueId: string): Promise<PrizePoolPayload | null> {
  const pool = await queryOne<PrizePoolRow>(
    `SELECT id, currency, "entryFeeMinor", "pctFirst", "pctSecond", "pctThird", "pctSecondLast",
            frozen, "frozenAt", "frozenMemberCount", "frozenPoolMinor", "createdAt"
       FROM prize_pool WHERE "leagueId" = $1`,
    [leagueId]
  );
  if (!pool) return null;

  await maybeFreeze(leagueId, pool);

  const ordered = await orderedEligibleMembers(leagueId, pool.frozen ? pool.frozenAt : null);
  const n = ordered.length;
  const poolMinor = pool.frozen ? pool.frozenPoolMinor ?? 0 : pool.entryFeeMinor * n;

  const weights: Record<PositionKey, number> = {
    first: pool.pctFirst,
    second: pool.pctSecond,
    third: pool.pctThird,
    secondLast: pool.pctSecondLast,
  };
  const amounts = splitPool(poolMinor, weights, n);

  const payoutAt = (key: PositionKey, idx: number) => {
    const amt = amounts[key];
    if (amt === undefined || idx < 0 || idx >= n) return null;
    return { amountMinor: amt, userId: ordered[idx]! };
  };

  return {
    currency: pool.currency,
    entryFeeMinor: pool.entryFeeMinor,
    pct: weights,
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
  pctSecondLast: number;
}

// Validate an admin's prize-pool input. Returns the normalised row values, or an
// { error } message for a 400.
export function validatePrizePoolInput(body: unknown): ValidatedPrizePool | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const currency = b.currency as Currency;
  const entryFeeMinor = b.entryFeeMinor as number;
  const pct = (b.pct ?? {}) as Record<string, unknown>;

  if (!CURRENCIES.includes(currency)) return { error: "currency must be GBP, USD, or JOD" };
  if (!Number.isInteger(entryFeeMinor) || entryFeeMinor <= 0) {
    return { error: "entryFeeMinor must be a positive integer (minor units)" };
  }
  const first = pct.first as number;
  const second = pct.second as number;
  const third = pct.third as number;
  const secondLast = pct.secondLast as number;
  for (const [k, v] of [["first", first], ["second", second], ["third", third], ["secondLast", secondLast]] as const) {
    if (!Number.isInteger(v) || v < 0 || v > 100) return { error: `pct.${k} must be an integer 0-100` };
  }
  if (first + second + third + secondLast !== 100) return { error: "percentages must sum to 100" };
  if (!(first >= second && second >= third && third >= secondLast)) {
    return { error: "percentages must be non-increasing (1st ≥ 2nd ≥ 3rd ≥ 2nd-last)" };
  }
  return { currency, entryFeeMinor, pctFirst: first, pctSecond: second, pctThird: third, pctSecondLast: secondLast };
}
