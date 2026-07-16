import type pg from "pg";

// NS1 — per-user notification preferences (PUSH_SPEC.md §3). Prefs belong to
// the person, not a device, so this is keyed by user_id. An absent row means
// all-on (defaults); a row is upserted the first time the user toggles.
export async function up(client: pg.PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS notification_pref (
      user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
      deadlines BOOLEAN NOT NULL DEFAULT true,
      results BOOLEAN NOT NULL DEFAULT true,
      updates BOOLEAN NOT NULL DEFAULT true,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function down(client: pg.PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS notification_pref`);
}
