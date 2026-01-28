import type { Database as DatabaseType } from "better-sqlite3";

export function up(db: DatabaseType): void {
  // Leagues table
  db.exec(`
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
    )
  `);

  // League members table
  db.exec(`
    CREATE TABLE IF NOT EXISTS league_member (
      id TEXT PRIMARY KEY,
      leagueId TEXT NOT NULL,
      userId TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'member')),
      joinedAt TEXT NOT NULL,
      FOREIGN KEY (leagueId) REFERENCES league(id),
      FOREIGN KEY (userId) REFERENCES user(id),
      UNIQUE(leagueId, userId)
    )
  `);

  // Create indexes for common queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_league_invite_code ON league(inviteCode);
    CREATE INDEX IF NOT EXISTS idx_league_member_league ON league_member(leagueId);
    CREATE INDEX IF NOT EXISTS idx_league_member_user ON league_member(userId);
  `);
}

export function down(db: DatabaseType): void {
  db.exec(`
    DROP TABLE IF EXISTS league_member;
    DROP TABLE IF EXISTS league;
  `);
}
