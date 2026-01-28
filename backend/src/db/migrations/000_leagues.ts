import type pg from "pg";

export async function up(client: pg.PoolClient): Promise<void> {
  // Leagues table
  await client.query(`
    CREATE TABLE IF NOT EXISTS league (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL CHECK(type IN ('premier_league', 'champions_league')),
      "inviteCode" TEXT NOT NULL UNIQUE,
      "createdBy" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL,
      "updatedAt" TIMESTAMPTZ NOT NULL,
      FOREIGN KEY ("createdBy") REFERENCES "user"(id)
    )
  `);

  // League members table
  await client.query(`
    CREATE TABLE IF NOT EXISTS league_member (
      id TEXT PRIMARY KEY,
      "leagueId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'member')),
      "joinedAt" TIMESTAMPTZ NOT NULL,
      FOREIGN KEY ("leagueId") REFERENCES league(id),
      FOREIGN KEY ("userId") REFERENCES "user"(id),
      UNIQUE("leagueId", "userId")
    )
  `);

  // Create indexes for common queries
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_league_invite_code ON league("inviteCode")
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_league_member_league ON league_member("leagueId")
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_league_member_user ON league_member("userId")
  `);
}

export async function down(client: pg.PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS league_member`);
  await client.query(`DROP TABLE IF EXISTS league`);
}
