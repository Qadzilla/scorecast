import type pg from "pg";

// NS1 — push dedup log (PUSH_SPEC.md §3). The UNIQUE constraint IS the dedup:
// every notification attempt tries to insert a row; ON CONFLICT DO NOTHING means
// "already sent — skip". Necessary because the reminder cron re-runs every 30 min
// and the results cron re-scores every 15 min. league_id is always set for
// per-league kinds so we never rely on NULL uniqueness semantics.
export async function up(client: pg.PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS push_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      league_id TEXT,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, kind, subject_id, league_id)
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_push_log_user ON push_log(user_id)`);
}

export async function down(client: pg.PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS push_log`);
}
