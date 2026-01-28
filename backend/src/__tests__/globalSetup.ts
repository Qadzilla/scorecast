import Database from "better-sqlite3";
import fs from "fs";

const testDbPath = "./test-data.db";

export default function setup() {
  // Remove test database if it exists to start fresh
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
    } catch (e) {
      // Ignore
    }
  }

  // Create test database with better-auth tables
  // (The app migrations will add the rest when db.ts is imported)
  const db = new Database(testDbPath);

  // Create better-auth required tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE NOT NULL,
      emailVerified INTEGER DEFAULT 0,
      image TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      username TEXT UNIQUE,
      firstName TEXT,
      lastName TEXT,
      favoriteTeamId TEXT
    );

    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      expiresAt TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      ipAddress TEXT,
      userAgent TEXT,
      userId TEXT NOT NULL REFERENCES user(id)
    );

    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      providerId TEXT NOT NULL,
      userId TEXT NOT NULL REFERENCES user(id),
      accessToken TEXT,
      refreshToken TEXT,
      idToken TEXT,
      accessTokenExpiresAt TEXT,
      refreshTokenExpiresAt TEXT,
      scope TEXT,
      password TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS league (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL CHECK(type IN ('premier_league', 'champions_league')),
      inviteCode TEXT NOT NULL UNIQUE,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (createdBy) REFERENCES user(id)
    );

    CREATE TABLE IF NOT EXISTS league_member (
      id TEXT PRIMARY KEY,
      leagueId TEXT NOT NULL,
      userId TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'member')),
      joinedAt TEXT NOT NULL,
      FOREIGN KEY (leagueId) REFERENCES league(id),
      FOREIGN KEY (userId) REFERENCES user(id),
      UNIQUE(leagueId, userId)
    );

    CREATE INDEX IF NOT EXISTS idx_league_invite_code ON league(inviteCode);
    CREATE INDEX IF NOT EXISTS idx_league_member_league ON league_member(leagueId);
    CREATE INDEX IF NOT EXISTS idx_league_member_user ON league_member(userId);
  `);

  db.close();

  console.log("Test database initialized");
}

export function teardown() {
  // Clean up test database after all tests
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
    } catch (e) {
      // Ignore
    }
  }
}
