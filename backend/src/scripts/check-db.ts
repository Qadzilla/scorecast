import { db } from "../db.js";

const stats = {
  teams: db.prepare("SELECT competition, COUNT(*) as count FROM team GROUP BY competition").all(),
  seasons: db.prepare("SELECT competition, name, isCurrent FROM season").all(),
  gameweeks: db.prepare(`
    SELECT s.competition, COUNT(g.id) as count,
           SUM(CASE WHEN g.status = 'upcoming' THEN 1 ELSE 0 END) as upcoming,
           SUM(CASE WHEN g.status = 'completed' THEN 1 ELSE 0 END) as completed
    FROM gameweek g
    JOIN season s ON g.seasonId = s.id
    GROUP BY s.competition
  `).all(),
  matches: db.prepare(`
    SELECT s.competition, COUNT(m.id) as count
    FROM match m
    JOIN matchday md ON m.matchdayId = md.id
    JOIN gameweek g ON md.gameweekId = g.id
    JOIN season s ON g.seasonId = s.id
    GROUP BY s.competition
  `).all(),
};

console.log("=== Database Summary ===\n");
console.log("Teams:", JSON.stringify(stats.teams, null, 2));
console.log("\nSeasons:", JSON.stringify(stats.seasons, null, 2));
console.log("\nGameweeks:", JSON.stringify(stats.gameweeks, null, 2));
console.log("\nMatches:", JSON.stringify(stats.matches, null, 2));
