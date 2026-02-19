import type pg from "pg";

export async function up(client: pg.PoolClient): Promise<void> {
  // Add stage column to gameweek table (nullable, NULL for PL)
  await client.query(`
    ALTER TABLE gameweek ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT NULL
  `);

  // Add currentMatchday to season table (for reference)
  await client.query(`
    ALTER TABLE season ADD COLUMN IF NOT EXISTS "currentMatchday" INTEGER DEFAULT NULL
  `);
}

export async function down(client: pg.PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE gameweek DROP COLUMN IF EXISTS stage
  `);
  await client.query(`
    ALTER TABLE season DROP COLUMN IF EXISTS "currentMatchday"
  `);
}
