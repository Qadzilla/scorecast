import type pg from "pg";

// MS6 — push notification token registry (MOBILE_PLAN.md §4.5).
// One row per device. A user may have several. Token is globally unique
// (Expo push tokens identify a device install); userId CASCADEs so deleting
// an account (MS5) also drops its tokens.
export async function up(client: pg.PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS push_token (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      platform TEXT NOT NULL CHECK(platform IN ('ios', 'android')),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_push_token_user ON push_token("userId")
  `);
}

export async function down(client: pg.PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS push_token`);
}
