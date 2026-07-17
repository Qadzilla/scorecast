import type pg from "pg";
import { queryOne } from "../db.js";

// One-time league-creation grants (AD2).

export async function hasUnusedGrant(userId: string): Promise<boolean> {
  const row = await queryOne(
    `SELECT 1 AS ok FROM league_creation_grant WHERE "userId" = $1 AND used = false LIMIT 1`,
    [userId]
  );
  return !!row;
}

// Consume the user's oldest unused grant, inside the create transaction (call
// after inserting the league so usedLeagueId can point at it).
export async function consumeGrant(client: pg.PoolClient, userId: string, leagueId: string): Promise<void> {
  await client.query(
    `UPDATE league_creation_grant
        SET used = true, "usedLeagueId" = $2, "usedAt" = now()
      WHERE id = (
        SELECT id FROM league_creation_grant
         WHERE "userId" = $1 AND used = false
         ORDER BY "createdAt" ASC
         LIMIT 1
      )`,
    [userId, leagueId]
  );
}
