import type { Database } from "better-sqlite3";

export function up(db: Database): void {
  // Add favoriteTeamId column to user table
  const hasColumn = db.prepare(`
    SELECT COUNT(*) as count FROM pragma_table_info('user') WHERE name = 'favoriteTeamId'
  `).get() as { count: number };

  if (hasColumn.count === 0) {
    db.exec(`ALTER TABLE user ADD COLUMN favoriteTeamId TEXT`);
  }
}
