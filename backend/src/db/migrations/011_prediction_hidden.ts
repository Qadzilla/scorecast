import type pg from "pg";

// Per-prediction privacy. When a player submits a gameweek, a single slider on
// the predict screen decides whether that submission's picks stay hidden from
// other members until the deadline passes. The choice is stored per prediction
// row (default false — visible). After the deadline everyone's picks are always
// visible regardless of this flag.
//
// This supersedes the earlier league-level `hidePredictions` flag (admin-chosen),
// which is dropped here.
export async function up(client: pg.PoolClient): Promise<void> {
  await client.query(
    `ALTER TABLE prediction ADD COLUMN IF NOT EXISTS "hidden" BOOLEAN NOT NULL DEFAULT false`
  );
  await client.query(`ALTER TABLE league DROP COLUMN IF EXISTS "hidePredictions"`);
}

export async function down(client: pg.PoolClient): Promise<void> {
  await client.query(`ALTER TABLE prediction DROP COLUMN IF EXISTS "hidden"`);
}
