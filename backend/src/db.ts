import pg from "pg";
import { up as leaguesMigration } from "./db/migrations/000_leagues.js";
import { up as fixturesMigration } from "./db/migrations/001_fixtures.js";
import { up as predictionsMigration } from "./db/migrations/002_predictions.js";
import { up as favoriteTeamMigration } from "./db/migrations/003_favorite_team.js";

const { Pool } = pg;

// Create PostgreSQL pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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
    await leaguesMigration(client);
    await fixturesMigration(client);
    await predictionsMigration(client);
    await favoriteTeamMigration(client);
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
