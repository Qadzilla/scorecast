/**
 * LS5 — seed an App Store review account (STORE_LISTING.md §6).
 *
 * Creates a pre-verified reviewer account, drops it into an existing populated
 * Premier League league, and gives it predictions for the current gameweek — so
 * the reviewer logs in and sees real fixtures, a table, and predictions instead
 * of empty states.
 *
 * Run against whatever DATABASE_URL is set (prod for the real review account):
 *   DATABASE_URL=<prod-url> npx tsx src/scripts/seed-review-account.ts
 *
 * Idempotent: safe to re-run. Credentials go in the App Store review notes.
 */
import crypto from "crypto";
import { auth } from "../auth.js";
import { initializeDatabase, closePool, query, queryOne, queryAll } from "../db.js";

const REVIEW_EMAIL = process.env.REVIEW_EMAIL || "review@scorecast.club";
const REVIEW_PASSWORD = process.env.REVIEW_PASSWORD || "ScoreCastReview!2026";
const REVIEW_USERNAME = process.env.REVIEW_USERNAME || "appreviewer";

async function ensureUser(): Promise<string> {
  const existing = await queryOne<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [REVIEW_EMAIL]);
  if (existing) {
    console.log("[seed] reviewer already exists:", REVIEW_EMAIL);
    return existing.id;
  }
  // Use the better-auth server API so the password is hashed correctly.
  await auth.api.signUpEmail({
    body: {
      email: REVIEW_EMAIL,
      password: REVIEW_PASSWORD,
      name: "App Reviewer",
      firstName: "App",
      lastName: "Reviewer",
      username: REVIEW_USERNAME,
    } as never,
  });
  const created = await queryOne<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [REVIEW_EMAIL]);
  if (!created) throw new Error("failed to create reviewer user");
  console.log("[seed] created reviewer:", REVIEW_EMAIL);
  return created.id;
}

async function main() {
  await initializeDatabase();
  const userId = await ensureUser();

  // Pre-verify so sign-in works without an OTP round-trip.
  await query(`UPDATE "user" SET "emailVerified" = true WHERE id = $1`, [userId]);

  // Give the reviewer a favorite team (skips the onboarding gate).
  const team = await queryOne<{ id: string }>(
    `SELECT id FROM team WHERE competition = 'premier_league' ORDER BY name LIMIT 1`
  );
  if (team) {
    await query(`UPDATE "user" SET "favoriteTeamId" = $1 WHERE id = $2`, [team.id, userId]);
  }

  // Find the most-populated Premier League league to join (real content).
  const league = await queryOne<{ id: string; name: string }>(
    `SELECT l.id, l.name, COUNT(lm.*) AS members
     FROM league l JOIN league_member lm ON lm."leagueId" = l.id
     WHERE l.type = 'premier_league'
     GROUP BY l.id, l.name
     ORDER BY members DESC
     LIMIT 1`
  );
  if (!league) {
    console.warn("[seed] no Premier League league found — reviewer created but not in a league.");
    await closePool();
    return;
  }

  const already = await queryOne(
    `SELECT id FROM league_member WHERE "leagueId" = $1 AND "userId" = $2`,
    [league.id, userId]
  );
  if (!already) {
    await query(
      `INSERT INTO league_member (id, "leagueId", "userId", role, "joinedAt")
       VALUES ($1, $2, $3, 'member', NOW())`,
      [crypto.randomUUID(), league.id, userId]
    );
  }
  console.log(`[seed] reviewer in league: ${league.name} (${league.id})`);

  // Predict the current/next gameweek's matches so the Predictions pane isn't empty.
  const gameweek = await queryOne<{ id: string }>(
    `SELECT gw.id FROM gameweek gw JOIN season s ON gw."seasonId" = s.id
     WHERE s.competition = 'premier_league'
     ORDER BY ABS(EXTRACT(EPOCH FROM (gw.deadline - NOW())))
     LIMIT 1`
  );
  if (gameweek) {
    const matches = await queryAll<{ id: string }>(
      `SELECT m.id FROM match m JOIN matchday md ON m."matchdayId" = md.id WHERE md."gameweekId" = $1`,
      [gameweek.id]
    );
    for (const m of matches) {
      const exists = await queryOne(
        `SELECT id FROM prediction WHERE "userId" = $1 AND "matchId" = $2 AND "leagueId" = $3`,
        [userId, m.id, league.id]
      );
      if (!exists) {
        await query(
          `INSERT INTO prediction (id, "userId", "matchId", "leagueId", "homeScore", "awayScore", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, 2, 1, NOW(), NOW())`,
          [crypto.randomUUID(), userId, m.id, league.id]
        );
      }
    }
    console.log(`[seed] seeded ${matches.length} predictions for gameweek ${gameweek.id}`);
  }

  console.log("\n[seed] DONE. Review credentials:");
  console.log(`  email:    ${REVIEW_EMAIL}`);
  console.log(`  password: ${REVIEW_PASSWORD}`);
  await closePool();
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
