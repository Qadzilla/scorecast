import "dotenv/config";
import { syncCompetition } from "../services/footballData.js";

async function main() {
  console.log("Syncing Champions League...\n");

  try {
    const result = await syncCompetition("champions_league");
    console.log("\n=== CL Sync Complete ===");
    console.log(`Teams: ${result.teams}`);
    console.log(`Matches: ${result.matches}`);
  } catch (error: any) {
    console.error("Sync failed:", error.message);
    process.exit(1);
  }
}

main();
