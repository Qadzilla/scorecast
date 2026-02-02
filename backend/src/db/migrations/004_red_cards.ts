import type pg from "pg";

export async function up(client: pg.PoolClient): Promise<void> {
  // Add red card columns to match table
  await client.query(`
    ALTER TABLE match
    ADD COLUMN IF NOT EXISTS "homeRedCards" INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "awayRedCards" INTEGER DEFAULT 0
  `);
}

export async function down(client: pg.PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE match
    DROP COLUMN IF EXISTS "homeRedCards",
    DROP COLUMN IF EXISTS "awayRedCards"
  `);
}
