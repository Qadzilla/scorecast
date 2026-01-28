import Database, { type Database as DatabaseType } from "better-sqlite3";
import { up as leaguesMigration } from "./db/migrations/000_leagues.js";
import { up as fixturesMigration } from "./db/migrations/001_fixtures.js";
import { up as predictionsMigration } from "./db/migrations/002_predictions.js";
import { up as favoriteTeamMigration } from "./db/migrations/003_favorite_team.js";

const isTest = process.env.NODE_ENV === "test";
const dbPath = isTest ? "./test-data.db" : "./data.db";
const db: DatabaseType = new Database(dbPath);

// Run migrations (order matters - leagues must exist before predictions)
leaguesMigration(db);
fixturesMigration(db);
predictionsMigration(db);
favoriteTeamMigration(db);

export { db };
