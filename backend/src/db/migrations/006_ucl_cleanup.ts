import type pg from "pg";

export async function up(client: pg.PoolClient): Promise<void> {
  // Check if the UNIQUE("seasonId", number) constraint still exists on gameweek
  const constraintCheck = await client.query(`
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'gameweek'
      AND constraint_type = 'UNIQUE'
      AND constraint_name = 'gameweek_seasonId_number_key'
    LIMIT 1
  `);

  if (constraintCheck.rows.length === 0) {
    console.log("[Migration 006] UNIQUE constraint already dropped — skipping");
    return;
  }

  console.log("[Migration 006] Dropping UNIQUE(seasonId, number) constraint on gameweek...");
  await client.query(`
    ALTER TABLE gameweek DROP CONSTRAINT "gameweek_seasonId_number_key"
  `);

  // Find all UCL season IDs
  const uclSeasons = await client.query(
    `SELECT id FROM season WHERE competition = 'champions_league'`
  );

  if (uclSeasons.rows.length === 0) {
    console.log("[Migration 006] No UCL seasons found — nothing to clean up");
    return;
  }

  const seasonIds = uclSeasons.rows.map((r: { id: string }) => r.id);
  console.log(`[Migration 006] Cleaning UCL data for seasons: ${seasonIds.join(", ")}`);

  // Delete in FK order: prediction → user_gameweek_score → match → matchday → gameweek
  await client.query(
    `DELETE FROM prediction WHERE "matchId" IN (
      SELECT m.id FROM match m
      JOIN matchday md ON m."matchdayId" = md.id
      JOIN gameweek gw ON md."gameweekId" = gw.id
      WHERE gw."seasonId" = ANY($1)
    )`,
    [seasonIds]
  );
  console.log("[Migration 006] Deleted UCL predictions");

  await client.query(
    `DELETE FROM user_gameweek_score WHERE "gameweekId" IN (
      SELECT id FROM gameweek WHERE "seasonId" = ANY($1)
    )`,
    [seasonIds]
  );
  console.log("[Migration 006] Deleted UCL user_gameweek_scores");

  await client.query(
    `DELETE FROM match WHERE "matchdayId" IN (
      SELECT md.id FROM matchday md
      JOIN gameweek gw ON md."gameweekId" = gw.id
      WHERE gw."seasonId" = ANY($1)
    )`,
    [seasonIds]
  );
  console.log("[Migration 006] Deleted UCL matches");

  await client.query(
    `DELETE FROM matchday WHERE "gameweekId" IN (
      SELECT id FROM gameweek WHERE "seasonId" = ANY($1)
    )`,
    [seasonIds]
  );
  console.log("[Migration 006] Deleted UCL matchdays");

  const deleted = await client.query(
    `DELETE FROM gameweek WHERE "seasonId" = ANY($1)`,
    [seasonIds]
  );
  console.log(`[Migration 006] Deleted ${deleted.rowCount} UCL gameweeks — clean slate`);
}

export async function down(client: pg.PoolClient): Promise<void> {
  // Re-add the UNIQUE constraint (data will need to be re-synced)
  await client.query(`
    ALTER TABLE gameweek ADD CONSTRAINT "gameweek_seasonId_number_key" UNIQUE("seasonId", number)
  `);
}
