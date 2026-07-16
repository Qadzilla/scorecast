import type pg from "pg";

// Per-league setting: hide members' predictions from each other until the
// gameweek deadline passes (default true — the competitive default). After the
// deadline everyone's picks are always visible regardless of this flag.
export async function up(client: pg.PoolClient): Promise<void> {
  await client.query(
    `ALTER TABLE league ADD COLUMN IF NOT EXISTS "hidePredictions" BOOLEAN NOT NULL DEFAULT true`
  );
}

export async function down(client: pg.PoolClient): Promise<void> {
  await client.query(`ALTER TABLE league DROP COLUMN IF EXISTS "hidePredictions"`);
}
