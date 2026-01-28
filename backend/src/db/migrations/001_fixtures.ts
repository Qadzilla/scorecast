import type { Database as DatabaseType } from "better-sqlite3";

export function up(db: DatabaseType): void {
  // Teams table
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
    )
  `);

  // Seasons table
  db.exec(`
    CREATE TABLE IF NOT EXISTS season (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      competition TEXT NOT NULL CHECK(competition IN ('premier_league', 'champions_league')),
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      isCurrent INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  // Gameweeks table
  db.exec(`
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
    )
  `);

  // Matchdays table
  db.exec(`
    CREATE TABLE IF NOT EXISTS matchday (
      id TEXT PRIMARY KEY,
      gameweekId TEXT NOT NULL,
      date TEXT NOT NULL,
      dayNumber INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (gameweekId) REFERENCES gameweek(id),
      UNIQUE(gameweekId, dayNumber)
    )
  `);

  // Matches table
  db.exec(`
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
    )
  `);

  // Create indexes for common queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_gameweek_season ON gameweek(seasonId);
    CREATE INDEX IF NOT EXISTS idx_gameweek_status ON gameweek(status);
    CREATE INDEX IF NOT EXISTS idx_matchday_gameweek ON matchday(gameweekId);
    CREATE INDEX IF NOT EXISTS idx_match_matchday ON match(matchdayId);
    CREATE INDEX IF NOT EXISTS idx_match_kickoff ON match(kickoffTime);
    CREATE INDEX IF NOT EXISTS idx_match_status ON match(status);
    CREATE INDEX IF NOT EXISTS idx_team_competition ON team(competition);
    CREATE INDEX IF NOT EXISTS idx_season_current ON season(isCurrent);
  `);
}

export function down(db: DatabaseType): void {
  db.exec(`
    DROP TABLE IF EXISTS match;
    DROP TABLE IF EXISTS matchday;
    DROP TABLE IF EXISTS gameweek;
    DROP TABLE IF EXISTS season;
    DROP TABLE IF EXISTS team;
  `);
}
