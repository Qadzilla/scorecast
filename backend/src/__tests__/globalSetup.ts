import Database from "better-sqlite3";
import fs from "fs";

const testDbPath = "./test-data.db";

export default function setup() {
  // Set environment
  process.env.NODE_ENV = "test";
  process.env.ADMIN_EMAIL = "test-admin@example.com";

  // Remove test database if it exists
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
    } catch (e) {
      // Ignore
    }
  }

  // Create test database with required schema
  const db = new Database(testDbPath);

  // Create better-auth tables first
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
  `);

  // Create fixtures tables (from 001_fixtures.ts)
  db.exec(`
    CREATE TABLE IF NOT EXISTS team (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      shortName TEXT NOT NULL,
      code TEXT NOT NULL,
      logo TEXT,
      competition TEXT NOT NULL CHECK(competition IN ('premier_league', 'champions_league')),
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS season (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      competition TEXT NOT NULL CHECK(competition IN ('premier_league', 'champions_league')),
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      isCurrent INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gameweek (
      id TEXT PRIMARY KEY,
      seasonId TEXT NOT NULL,
      number INTEGER NOT NULL,
      name TEXT,
      deadline TEXT NOT NULL,
      startsAt TEXT NOT NULL,
      endsAt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'upcoming' CHECK(status IN ('upcoming', 'active', 'completed')),
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (seasonId) REFERENCES season(id),
      UNIQUE(seasonId, number)
    );

    CREATE TABLE IF NOT EXISTS matchday (
      id TEXT PRIMARY KEY,
      gameweekId TEXT NOT NULL,
      date TEXT NOT NULL,
      dayNumber INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (gameweekId) REFERENCES gameweek(id),
      UNIQUE(gameweekId, dayNumber)
    );

    CREATE TABLE IF NOT EXISTS match (
      id TEXT PRIMARY KEY,
      matchdayId TEXT NOT NULL,
      homeTeamId TEXT NOT NULL,
      awayTeamId TEXT NOT NULL,
      kickoffTime TEXT NOT NULL,
      homeScore INTEGER,
      awayScore INTEGER,
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'live', 'finished', 'postponed', 'cancelled')),
      venue TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (matchdayId) REFERENCES matchday(id),
      FOREIGN KEY (homeTeamId) REFERENCES team(id),
      FOREIGN KEY (awayTeamId) REFERENCES team(id)
    );

    CREATE INDEX IF NOT EXISTS idx_gameweek_season ON gameweek(seasonId);
    CREATE INDEX IF NOT EXISTS idx_gameweek_status ON gameweek(status);
    CREATE INDEX IF NOT EXISTS idx_matchday_gameweek ON matchday(gameweekId);
    CREATE INDEX IF NOT EXISTS idx_match_matchday ON match(matchdayId);
    CREATE INDEX IF NOT EXISTS idx_match_kickoff ON match(kickoffTime);
    CREATE INDEX IF NOT EXISTS idx_match_status ON match(status);
    CREATE INDEX IF NOT EXISTS idx_team_competition ON team(competition);
    CREATE INDEX IF NOT EXISTS idx_season_current ON season(isCurrent);
  `);

  // Create league tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS league (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL DEFAULT 'premier_league' CHECK(type IN ('premier_league', 'champions_league')),
      inviteCode TEXT UNIQUE NOT NULL,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (createdBy) REFERENCES user(id)
    );

    CREATE TABLE IF NOT EXISTS league_member (
      id TEXT PRIMARY KEY,
      leagueId TEXT NOT NULL,
      userId TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'member')),
      joinedAt TEXT NOT NULL,
      FOREIGN KEY (leagueId) REFERENCES league(id),
      FOREIGN KEY (userId) REFERENCES user(id),
      UNIQUE(leagueId, userId)
    );
  `);

  // Create predictions tables (from 002_predictions.ts)
  db.exec(`
    CREATE TABLE IF NOT EXISTS prediction (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      matchId TEXT NOT NULL,
      leagueId TEXT NOT NULL,
      homeScore INTEGER NOT NULL,
      awayScore INTEGER NOT NULL,
      points INTEGER,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES user(id),
      FOREIGN KEY (matchId) REFERENCES match(id),
      FOREIGN KEY (leagueId) REFERENCES league(id),
      UNIQUE(userId, matchId, leagueId)
    );

    CREATE TABLE IF NOT EXISTS user_gameweek_score (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      gameweekId TEXT NOT NULL,
      leagueId TEXT NOT NULL,
      totalPoints INTEGER NOT NULL DEFAULT 0,
      exactScores INTEGER NOT NULL DEFAULT 0,
      correctResults INTEGER NOT NULL DEFAULT 0,
      predictedMatches INTEGER NOT NULL DEFAULT 0,
      scoredMatches INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES user(id),
      FOREIGN KEY (gameweekId) REFERENCES gameweek(id),
      FOREIGN KEY (leagueId) REFERENCES league(id),
      UNIQUE(userId, gameweekId, leagueId)
    );

    CREATE TABLE IF NOT EXISTS user_league_standing (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      leagueId TEXT NOT NULL,
      totalPoints INTEGER NOT NULL DEFAULT 0,
      gameweeksPlayed INTEGER NOT NULL DEFAULT 0,
      exactScores INTEGER NOT NULL DEFAULT 0,
      correctResults INTEGER NOT NULL DEFAULT 0,
      currentRank INTEGER,
      previousRank INTEGER,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES user(id),
      FOREIGN KEY (leagueId) REFERENCES league(id),
      UNIQUE(userId, leagueId)
    );

    CREATE INDEX IF NOT EXISTS idx_prediction_user ON prediction(userId);
    CREATE INDEX IF NOT EXISTS idx_prediction_match ON prediction(matchId);
    CREATE INDEX IF NOT EXISTS idx_prediction_league ON prediction(leagueId);
    CREATE INDEX IF NOT EXISTS idx_prediction_user_league ON prediction(userId, leagueId);

    CREATE INDEX IF NOT EXISTS idx_gameweek_score_user ON user_gameweek_score(userId);
    CREATE INDEX IF NOT EXISTS idx_gameweek_score_gameweek ON user_gameweek_score(gameweekId);
    CREATE INDEX IF NOT EXISTS idx_gameweek_score_league ON user_gameweek_score(leagueId);
    CREATE INDEX IF NOT EXISTS idx_gameweek_score_points ON user_gameweek_score(totalPoints DESC);

    CREATE INDEX IF NOT EXISTS idx_standing_league ON user_league_standing(leagueId);
    CREATE INDEX IF NOT EXISTS idx_standing_points ON user_league_standing(totalPoints DESC);
    CREATE INDEX IF NOT EXISTS idx_standing_rank ON user_league_standing(currentRank);
  `);

  // Insert test data
  const now = new Date().toISOString();
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.exec(`
    INSERT INTO season (id, name, competition, startDate, endDate, isCurrent, createdAt, updatedAt)
    VALUES ('test-season-1', '2024/25', 'premier_league', '2024-08-01', '2025-05-31', 1, '${now}', '${now}');

    INSERT INTO gameweek (id, seasonId, number, name, deadline, startsAt, endsAt, status, createdAt, updatedAt)
    VALUES ('test-gw-1', 'test-season-1', 1, 'Gameweek 1', '${futureDate}', '${now}', '${futureDate}', 'upcoming', '${now}', '${now}');

    INSERT INTO matchday (id, gameweekId, date, dayNumber, createdAt, updatedAt)
    VALUES ('test-matchday-1', 'test-gw-1', '${futureDate}', 1, '${now}', '${now}');

    INSERT INTO team (id, name, shortName, code, logo, competition, createdAt, updatedAt) VALUES
    ('team-1', 'Manchester United', 'MUN', 'MUN', '/logos/mun.png', 'premier_league', '${now}', '${now}'),
    ('team-2', 'Liverpool', 'LIV', 'LIV', '/logos/liv.png', 'premier_league', '${now}', '${now}'),
    ('team-3', 'Arsenal', 'ARS', 'ARS', '/logos/ars.png', 'premier_league', '${now}', '${now}');

    INSERT INTO match (id, matchdayId, homeTeamId, awayTeamId, kickoffTime, status, createdAt, updatedAt)
    VALUES ('test-match-1', 'test-matchday-1', 'team-1', 'team-2', '${futureDate}', 'scheduled', '${now}', '${now}');
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
