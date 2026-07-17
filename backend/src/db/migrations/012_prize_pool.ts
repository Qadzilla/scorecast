import type pg from "pg";

// Display-only prize pool (PRIZE_POOL_SPEC.md). One optional pool per league.
// Money is stored in integer minor units (pence/cents/fils) to avoid float drift.
// Split weights default to 50/25/15/10 (1st/2nd/3rd/2nd-last); validation of
// sum=100 and non-increasing order lives in the route. Freeze fields are set
// when the first deadline after creation passes (the pool locks at "GW1").
export async function up(client: pg.PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS prize_pool (
      id                  TEXT PRIMARY KEY,
      "leagueId"          TEXT NOT NULL UNIQUE REFERENCES league(id) ON DELETE CASCADE,
      currency            TEXT NOT NULL,
      "entryFeeMinor"     INTEGER NOT NULL,
      "pctFirst"          INTEGER NOT NULL DEFAULT 50,
      "pctSecond"         INTEGER NOT NULL DEFAULT 25,
      "pctThird"          INTEGER NOT NULL DEFAULT 15,
      "pctSecondLast"     INTEGER NOT NULL DEFAULT 10,
      frozen              BOOLEAN NOT NULL DEFAULT false,
      "frozenAt"          TIMESTAMPTZ,
      "frozenMemberCount" INTEGER,
      "frozenPoolMinor"   INTEGER,
      "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function down(client: pg.PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS prize_pool`);
}
