import type pg from "pg";

// One-time league-creation grants (AD2). The global admin grants a specific user
// the ability to create ONE league; creating it consumes the grant (used=true,
// usedLeagueId set). `hasUnusedGrant` gates POST /leagues + /me.canCreateLeague.
export async function up(client: pg.PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS league_creation_grant (
      id             TEXT PRIMARY KEY,
      "userId"       TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      "grantedBy"    TEXT NOT NULL REFERENCES "user"(id),
      used           BOOLEAN NOT NULL DEFAULT false,
      "usedLeagueId" TEXT REFERENCES league(id) ON DELETE SET NULL,
      "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
      "usedAt"       TIMESTAMPTZ
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_grant_user ON league_creation_grant("userId")`);
}

export async function down(client: pg.PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS league_creation_grant`);
}
