import pg from "pg";

const { Pool } = pg;

// Use a dedicated test database
const TEST_DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/scorecast_test";

export default async function setup() {
  const pool = new Pool({
    connectionString: TEST_DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    // Drop all existing tables to start fresh
    await client.query(`
      DROP TABLE IF EXISTS prediction CASCADE;
      DROP TABLE IF EXISTS user_gameweek_score CASCADE;
      DROP TABLE IF EXISTS user_league_standing CASCADE;
      DROP TABLE IF EXISTS match CASCADE;
      DROP TABLE IF EXISTS matchday CASCADE;
      DROP TABLE IF EXISTS gameweek CASCADE;
      DROP TABLE IF EXISTS season CASCADE;
      DROP TABLE IF EXISTS team CASCADE;
      DROP TABLE IF EXISTS league_member CASCADE;
      DROP TABLE IF EXISTS league CASCADE;
      DROP TABLE IF EXISTS verification CASCADE;
      DROP TABLE IF EXISTS account CASCADE;
      DROP TABLE IF EXISTS session CASCADE;
      DROP TABLE IF EXISTS "user" CASCADE;
    `);

    // Create better-auth required tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS "user" (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE NOT NULL,
        "emailVerified" BOOLEAN DEFAULT false,
        image TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL,
        "updatedAt" TIMESTAMPTZ NOT NULL,
        username TEXT UNIQUE,
        "firstName" TEXT,
        "lastName" TEXT,
        "favoriteTeamId" TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS session (
        id TEXT PRIMARY KEY,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        token TEXT NOT NULL UNIQUE,
        "createdAt" TIMESTAMPTZ NOT NULL,
        "updatedAt" TIMESTAMPTZ NOT NULL,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "userId" TEXT NOT NULL REFERENCES "user"(id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS account (
        id TEXT PRIMARY KEY,
        "accountId" TEXT NOT NULL,
        "providerId" TEXT NOT NULL,
        "userId" TEXT NOT NULL REFERENCES "user"(id),
        "accessToken" TEXT,
        "refreshToken" TEXT,
        "idToken" TEXT,
        "accessTokenExpiresAt" TIMESTAMPTZ,
        "refreshTokenExpiresAt" TIMESTAMPTZ,
        scope TEXT,
        password TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL,
        "updatedAt" TIMESTAMPTZ NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS verification (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL,
        value TEXT NOT NULL,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ,
        "updatedAt" TIMESTAMPTZ
      )
    `);

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

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_league_invite_code ON league("inviteCode")
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_league_member_league ON league_member("leagueId")
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_league_member_user ON league_member("userId")
    `);

    console.log("Test database initialized");
  } finally {
    client.release();
    await pool.end();
  }
}

export async function teardown() {
  // Tests use the same database, so no cleanup needed here
  // Each test run starts fresh via globalSetup
}
