import type pg from "pg";

export async function up(client: pg.PoolClient): Promise<void> {
  // Check if favoriteTeamId column exists using information_schema
  const result = await client.query(`
    SELECT COUNT(*) as count
    FROM information_schema.columns
    WHERE table_name = 'user' AND column_name = 'favoriteTeamId'
  `);

  const hasColumn = parseInt(result.rows[0]?.count ?? "0", 10) > 0;

  if (!hasColumn) {
    await client.query(`ALTER TABLE "user" ADD COLUMN "favoriteTeamId" TEXT`);
  }
}
