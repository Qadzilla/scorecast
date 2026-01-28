import { queryAll, initializeDatabase } from "../db.js";

async function checkDatabase() {
  await initializeDatabase();

  const teams = await queryAll<{ competition: string; count: string }>(
    "SELECT competition, COUNT(*) as count FROM team GROUP BY competition"
  );
  const seasons = await queryAll(
    `SELECT competition, name, "isCurrent" FROM season`
  );
  const gameweeks = await queryAll<{
    competition: string;
    count: string;
    upcoming: string;
    completed: string;
  }>(`
    SELECT s.competition, COUNT(g.id) as count,
           SUM(CASE WHEN g.status = 'upcoming' THEN 1 ELSE 0 END) as upcoming,
           SUM(CASE WHEN g.status = 'completed' THEN 1 ELSE 0 END) as completed
    FROM gameweek g
    JOIN season s ON g."seasonId" = s.id
    GROUP BY s.competition
  `);
  const matches = await queryAll<{ competition: string; count: string }>(`
    SELECT s.competition, COUNT(m.id) as count
    FROM match m
    JOIN matchday md ON m."matchdayId" = md.id
    JOIN gameweek g ON md."gameweekId" = g.id
    JOIN season s ON g."seasonId" = s.id
    GROUP BY s.competition
  `);

  console.log("=== Database Summary ===\n");
  console.log("Teams:", JSON.stringify(teams, null, 2));
  console.log("\nSeasons:", JSON.stringify(seasons, null, 2));
  console.log("\nGameweeks:", JSON.stringify(gameweeks, null, 2));
  console.log("\nMatches:", JSON.stringify(matches, null, 2));

  process.exit(0);
}

checkDatabase().catch(console.error);
