import "dotenv/config";
import { syncAll } from "../services/footballData.js";

async function main() {
  console.log("Starting fixture sync...\n");

  try {
    const result = await syncAll();

    console.log("\n=== Sync Complete ===");
    console.log("\nPremier League:");
    console.log(`  Teams: ${result.premier_league.teams}`);
    console.log(`  Matches: ${result.premier_league.matches}`);

    console.log("\nChampions League:");
    console.log(`  Teams: ${result.champions_league.teams}`);
    console.log(`  Matches: ${result.champions_league.matches}`);

    console.log("\nDone!");
  } catch (error: any) {
    console.error("Sync failed:", error.message);
    process.exit(1);
  }
}

main();
