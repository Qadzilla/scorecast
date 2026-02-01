import { app } from "./app.js";
import { initializeDatabase, queryAll } from "./db.js";
import { syncAll, updateMatchResults } from "./services/footballData.js";
import { scorePredictionsForMatch } from "./routes/predictions.js";
import cron from "node-cron";

const PORT = process.env.PORT || 3000;

async function runSync() {
  try {
    console.log("[Sync] Starting automatic sync...");
    const result = await syncAll();
    console.log("[Sync] Completed:", JSON.stringify(result));

    // Score any predictions for matches that got results during sync
    const unscoredMatches = await queryAll<{ id: string }>(
      `SELECT DISTINCT m.id FROM match m
       JOIN prediction p ON p."matchId" = m.id
       WHERE m.status = 'finished' AND p.points IS NULL`
    );

    if (unscoredMatches.length > 0) {
      console.log(`[Sync] Scoring ${unscoredMatches.length} matches with unscored predictions...`);
      for (const match of unscoredMatches) {
        await scorePredictionsForMatch(match.id);
      }
      console.log("[Sync] Scoring completed");
    }
  } catch (error) {
    console.error("[Sync] Failed:", error);
  }
}

async function runResultsUpdate() {
  try {
    console.log("[Results] Updating match results...");
    await updateMatchResults("premier_league");
    await updateMatchResults("champions_league");

    // Score predictions for finished matches that haven't been scored yet
    const unscoredMatches = await queryAll<{ id: string }>(
      `SELECT DISTINCT m.id FROM match m
       JOIN prediction p ON p."matchId" = m.id
       WHERE m.status = 'finished' AND p.points IS NULL`
    );

    if (unscoredMatches.length > 0) {
      console.log(`[Results] Scoring ${unscoredMatches.length} matches with unscored predictions...`);
      for (const match of unscoredMatches) {
        await scorePredictionsForMatch(match.id);
      }
      console.log("[Results] Scoring completed");
    }

    console.log("[Results] Update completed");
  } catch (error) {
    console.error("[Results] Update failed:", error);
  }
}

async function start() {
  try {
    // Initialize database (run migrations)
    await initializeDatabase();
    console.log("Database initialized");

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

    // Run initial sync after 5 seconds (let server start first)
    setTimeout(runSync, 5000);

    // Schedule full sync every 6 hours (at minute 0)
    cron.schedule("0 */6 * * *", runSync);

    // Schedule results update every hour (at minute 30)
    cron.schedule("30 * * * *", runResultsUpdate);

    console.log("[Cron] Scheduled: full sync every 6 hours, results update every hour");
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();
