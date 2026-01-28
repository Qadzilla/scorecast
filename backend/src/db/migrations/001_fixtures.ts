import type pg from "pg";

export async function up(client: pg.PoolClient): Promise<void> {
  // Teams table
  await client.query(`
    CREATE TABLE IF NOT EXISTS team (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      "shortName" TEXT NOT NULL,
      code TEXT NOT NULL,
      logo TEXT,
      competition TEXT NOT NULL CHECK(competition IN ('premier_league', 'champions_league')),
      "createdAt" TIMESTAMPTZ NOT NULL,
      "updatedAt" TIMESTAMPTZ NOT NULL
    )
  `);

  // Seasons table
  await client.query(`
    CREATE TABLE IF NOT EXISTS season (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      competition TEXT NOT NULL CHECK(competition IN ('premier_league', 'champions_league')),
      "startDate" TIMESTAMPTZ NOT NULL,
      "endDate" TIMESTAMPTZ NOT NULL,
      "isCurrent" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMPTZ NOT NULL,
      "updatedAt" TIMESTAMPTZ NOT NULL
    )
  `);

  // Gameweeks table
  await client.query(`
    CREATE TABLE IF NOT EXISTS gameweek (
      id TEXT PRIMARY KEY,
      "seasonId" TEXT NOT NULL,
      number INTEGER NOT NULL,
      name TEXT,
      deadline TIMESTAMPTZ NOT NULL,
      "startsAt" TIMESTAMPTZ NOT NULL,
      "endsAt" TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'upcoming' CHECK(status IN ('upcoming', 'active', 'completed')),
      "createdAt" TIMESTAMPTZ NOT NULL,
      "updatedAt" TIMESTAMPTZ NOT NULL,
      FOREIGN KEY ("seasonId") REFERENCES season(id),
      UNIQUE("seasonId", number)
    )
  `);

  // Matchdays table
  await client.query(`
    CREATE TABLE IF NOT EXISTS matchday (
      id TEXT PRIMARY KEY,
      "gameweekId" TEXT NOT NULL,
      date TEXT NOT NULL,
      "dayNumber" INTEGER NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL,
      "updatedAt" TIMESTAMPTZ NOT NULL,
      FOREIGN KEY ("gameweekId") REFERENCES gameweek(id),
      UNIQUE("gameweekId", "dayNumber")
    )
  `);

  // Matches table
  await client.query(`
    CREATE TABLE IF NOT EXISTS match (
      id TEXT PRIMARY KEY,
      "matchdayId" TEXT NOT NULL,
      "homeTeamId" TEXT NOT NULL,
      "awayTeamId" TEXT NOT NULL,
      "kickoffTime" TIMESTAMPTZ NOT NULL,
      "homeScore" INTEGER,
      "awayScore" INTEGER,
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'live', 'finished', 'postponed', 'cancelled')),
      venue TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL,
      "updatedAt" TIMESTAMPTZ NOT NULL,
      FOREIGN KEY ("matchdayId") REFERENCES matchday(id),
      FOREIGN KEY ("homeTeamId") REFERENCES team(id),
      FOREIGN KEY ("awayTeamId") REFERENCES team(id)
    )
  `);

  // Create indexes for common queries
  await client.query(`CREATE INDEX IF NOT EXISTS idx_gameweek_season ON gameweek("seasonId")`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_gameweek_status ON gameweek(status)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_matchday_gameweek ON matchday("gameweekId")`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_match_matchday ON match("matchdayId")`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_match_kickoff ON match("kickoffTime")`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_match_status ON match(status)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_team_competition ON team(competition)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_season_current ON season("isCurrent")`);
}

export async function down(client: pg.PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS match`);
  await client.query(`DROP TABLE IF EXISTS matchday`);
  await client.query(`DROP TABLE IF EXISTS gameweek`);
  await client.query(`DROP TABLE IF EXISTS season`);
  await client.query(`DROP TABLE IF EXISTS team`);
}
