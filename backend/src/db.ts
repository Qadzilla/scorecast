import pg from "pg";
import { up as leaguesMigration } from "./db/migrations/000_leagues.js";
import { up as fixturesMigration } from "./db/migrations/001_fixtures.js";
import { up as predictionsMigration } from "./db/migrations/002_predictions.js";
import { up as favoriteTeamMigration } from "./db/migrations/003_favorite_team.js";
import { up as redCardsMigration } from "./db/migrations/004_red_cards.js";
import { up as stageAndMatchdayMigration } from "./db/migrations/005_stage_and_matchday.js";

const { Pool } = pg;

// Create PostgreSQL pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create better-auth tables if they don't exist
async function createAuthTables(client: pg.PoolClient): Promise<void> {
  // Create user table (better-auth core table)
  await client.query(`
    CREATE TABLE IF NOT EXISTS "user" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "email" TEXT NOT NULL UNIQUE,
      "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
      "image" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "username" TEXT UNIQUE,
      "firstName" TEXT,
      "lastName" TEXT
    )
  `);

  // Create session table
  await client.query(`
    CREATE TABLE IF NOT EXISTS "session" (
      "id" TEXT PRIMARY KEY,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      "token" TEXT NOT NULL UNIQUE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
    )
  `);

  // Create account table
  await client.query(`
    CREATE TABLE IF NOT EXISTS "account" (
      "id" TEXT PRIMARY KEY,
      "accountId" TEXT NOT NULL,
      "providerId" TEXT NOT NULL,
      "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "accessToken" TEXT,
      "refreshToken" TEXT,
      "idToken" TEXT,
      "accessTokenExpiresAt" TIMESTAMPTZ,
      "refreshTokenExpiresAt" TIMESTAMPTZ,
      "scope" TEXT,
      "password" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Create verification table
  await client.query(`
    CREATE TABLE IF NOT EXISTS "verification" (
      "id" TEXT PRIMARY KEY,
      "identifier" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

// Query helper - returns all rows
export async function queryAll<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

// Query helper - returns first row or undefined
export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | undefined> {
  const result = await pool.query(text, params);
  return result.rows[0] as T | undefined;
}

// Query helper - for INSERT/UPDATE/DELETE, returns row count
export async function query(
  text: string,
  params?: unknown[]
): Promise<{ rowCount: number }> {
  const result = await pool.query(text, params);
  return { rowCount: result.rowCount ?? 0 };
}

// Transaction helper
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// Run migrations
export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    // First create better-auth tables
    await createAuthTables(client);
    // Then run our custom migrations
    await leaguesMigration(client);
    await fixturesMigration(client);
    await predictionsMigration(client);
    await favoriteTeamMigration(client);
    await redCardsMigration(client);
    await stageAndMatchdayMigration(client);
  } finally {
    client.release();
  }
}

// Initialize database (runs migrations)
let initialized = false;
export async function initializeDatabase(): Promise<void> {
  if (initialized) return;
  await runMigrations();
  initialized = true;
}

// For graceful shutdown
export async function closePool(): Promise<void> {
  await pool.end();
}
