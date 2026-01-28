import { app } from "./app.js";
import { initializeDatabase } from "./db.js";
import { syncAll, updateMatchResults } from "./services/footballData.js";
import cron from "node-cron";

const PORT = process.env.PORT || 3000;

async function runSync() {
  try {
    console.log("[Sync] Starting automatic sync...");
    const result = await syncAll();
    console.log("[Sync] Completed:", JSON.stringify(result));
  } catch (error) {
    console.error("[Sync] Failed:", error);
  }
}

async function runResultsUpdate() {
  try {
    console.log("[Results] Updating match results...");
    await updateMatchResults("premier_league");
    await updateMatchResults("champions_league");
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
