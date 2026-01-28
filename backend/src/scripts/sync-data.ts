import { initializeDatabase } from "../db.js";
import { syncAll } from "../services/footballData.js";

async function syncData() {
  await initializeDatabase();

  console.log("Syncing all competitions...");
  const result = await syncAll();
  console.log("Sync complete:", JSON.stringify(result, null, 2));

  process.exit(0);
}

syncData().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
