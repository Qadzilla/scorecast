import type pg from "pg";

// Payout rework: 2nd-last is now always "money back" (the entry fee), not a
// percentage; 3rd can be toggled to money-back too. The percentage positions
// (1st, 2nd, and 3rd when it's a %) split what's left after the money-back
// payouts. Drop the now-unused pctSecondLast; add thirdMoneyBack.
export async function up(client: pg.PoolClient): Promise<void> {
  await client.query(
    `ALTER TABLE prize_pool ADD COLUMN IF NOT EXISTS "thirdMoneyBack" BOOLEAN NOT NULL DEFAULT false`
  );
  await client.query(`ALTER TABLE prize_pool DROP COLUMN IF EXISTS "pctSecondLast"`);
}

export async function down(client: pg.PoolClient): Promise<void> {
  await client.query(`ALTER TABLE prize_pool DROP COLUMN IF EXISTS "thirdMoneyBack"`);
  await client.query(`ALTER TABLE prize_pool ADD COLUMN IF NOT EXISTS "pctSecondLast" INTEGER NOT NULL DEFAULT 10`);
}
