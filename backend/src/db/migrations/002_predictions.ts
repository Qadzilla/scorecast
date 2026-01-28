import type { Database as DatabaseType } from "better-sqlite3";

export function up(db: DatabaseType): void {
  // Predictions table - one row per user per match per league
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
    )
  `);

  // User gameweek scores - cached totals for leaderboard performance
  db.exec(`
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
    )
  `);

  // User league standings - cached overall totals
  db.exec(`
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
    )
  `);

  // Create indexes for common queries
  db.exec(`
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
}

export function down(db: DatabaseType): void {
  db.exec(`
    DROP TABLE IF EXISTS user_league_standing;
    DROP TABLE IF EXISTS user_gameweek_score;
    DROP TABLE IF EXISTS prediction;
  `);
}
