/**
 * Seed a demo "Test League" on YOUR account so you can view the app with real
 * content — a full table, predictions, and a prize pool.
 *
 *   TARGET_EMAIL=you@example.com DATABASE_URL=<db-url> npx tsx src/scripts/seed-test-league.ts
 *
 * TARGET_EMAIL must already be a signed-up account (the one you log in with).
 * Creates 6 pre-verified test players + you in a Premier League "Test League"
 * (you as admin, placed 2nd so you see your own prize badge), predictions that
 * produce a 7-player table, and a £5 GBP prize pool (50/25/15/10).
 *
 * Idempotent: wipes a prior "Test League" you own before reseeding, and reuses
 * test players by email. Runs migrations first, so it also creates the
 * prize_pool table if the DB predates PP1a.
 *
 * NOTE: the prize pool CARD only renders in the app once the PP1a backend is
 * deployed (the app calls GET /prize-pool). The league + table show regardless.
 */
import crypto from "crypto";
import { auth } from "../auth.js";
import { initializeDatabase, closePool, query, queryOne, queryAll } from "../db.js";

const TARGET_EMAIL = process.env.TARGET_EMAIL || process.argv[2];
const TEST_PASSWORD = process.env.TEST_PASSWORD || "TestPlayer!2026";
const LEAGUE_NAME = "Test League";
const ENTRY_FEE_MINOR = 500; // £5.00

// 6 test players (ordered by strength — index 0 is strongest). You slot in 2nd.
const PLAYERS = [
  { email: "testplayer1@scorecast.test", name: "Alex Turner", username: "alex_test" },
  { email: "testplayer2@scorecast.test", name: "Sam Rivera", username: "sam_test" },
  { email: "testplayer3@scorecast.test", name: "Jordan Blake", username: "jordan_test" },
  { email: "testplayer4@scorecast.test", name: "Casey Lin", username: "casey_test" },
  { email: "testplayer5@scorecast.test", name: "Morgan Reid", username: "morgan_test" },
  { email: "testplayer6@scorecast.test", name: "Riley Cross", username: "riley_test" },
];

async function ensureUser(email: string, name: string, username: string): Promise<string> {
  const existing = await queryOne<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [email]);
  if (existing) return existing.id;
  await auth.api.signUpEmail({
    body: {
      email, password: TEST_PASSWORD, name,
      firstName: name.split(" ")[0], lastName: name.split(" ").slice(1).join(" ") || "Test",
      username,
    } as never,
  });
  const created = await queryOne<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [email]);
  if (!created) throw new Error(`failed to create ${email}`);
  return created.id;
}

async function main() {
  if (!TARGET_EMAIL) {
    console.error("Set TARGET_EMAIL to the account you log in with, e.g.\n  TARGET_EMAIL=you@example.com DATABASE_URL=<url> npx tsx src/scripts/seed-test-league.ts");
    process.exit(1);
  }
  await initializeDatabase();

  const target = await queryOne<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [TARGET_EMAIL]);
  if (!target) {
    console.error(`No account for ${TARGET_EMAIL}. Sign up / log in with that email in the app first, then re-run.`);
    await closePool();
    process.exit(1);
  }

  // Premier League teams for varied crests.
  const teams = await queryAll<{ id: string }>(
    `SELECT id FROM team WHERE competition = 'premier_league' ORDER BY name`
  );

  // Create test players (pre-verified, each with a favourite team).
  const playerIds: string[] = [];
  for (let i = 0; i < PLAYERS.length; i++) {
    const p = PLAYERS[i]!;
    const id = await ensureUser(p.email, p.name, p.username);
    await query(`UPDATE "user" SET "emailVerified" = true WHERE id = $1`, [id]);
    if (teams[i % Math.max(teams.length, 1)]) {
      await query(`UPDATE "user" SET "favoriteTeamId" = $1 WHERE id = $2 AND "favoriteTeamId" IS NULL`, [teams[i % teams.length]!.id, id]);
    }
    playerIds.push(id);
  }

  // Wipe a prior Test League owned by the target (explicit child deletes — no
  // reliance on FK cascades except prize_pool's).
  const prior = await queryAll<{ id: string }>(
    `SELECT id FROM league WHERE name = $1 AND "createdBy" = $2`,
    [LEAGUE_NAME, target.id]
  );
  for (const l of prior) {
    await query(`DELETE FROM prediction WHERE "leagueId" = $1`, [l.id]);
    await query(`DELETE FROM league_member WHERE "leagueId" = $1`, [l.id]);
    await query(`DELETE FROM prize_pool WHERE "leagueId" = $1`, [l.id]);
    await query(`DELETE FROM league WHERE id = $1`, [l.id]);
  }

  // Create the league (target = admin).
  const leagueId = crypto.randomUUID();
  const inviteCode = crypto.randomBytes(4).toString("hex").toUpperCase();
  const now = new Date().toISOString();
  await query(
    `INSERT INTO league (id, name, type, "inviteCode", "createdBy", "createdAt", "updatedAt")
     VALUES ($1, $2, 'premier_league', $3, $4, $5, $5)`,
    [leagueId, LEAGUE_NAME, inviteCode, target.id, now]
  );

  // Roster ordered by final position: strongest test player 1st, YOU 2nd, then
  // the rest. 7 members → 2nd-last is rank 6.
  const ranked: string[] = [playerIds[0]!, target.id, ...playerIds.slice(1)];
  for (const userId of ranked) {
    const role = userId === target.id ? "admin" : "member";
    await query(
      `INSERT INTO league_member (id, "leagueId", "userId", role, "joinedAt") VALUES ($1, $2, $3, $4, $5)`,
      [crypto.randomUUID(), leagueId, userId, role, now]
    );
  }

  // The gameweek closest to now, and its matches.
  const gameweek = await queryOne<{ id: string }>(
    `SELECT gw.id FROM gameweek gw JOIN season s ON gw."seasonId" = s.id
     WHERE s.competition = 'premier_league'
     ORDER BY ABS(EXTRACT(EPOCH FROM (gw.deadline - NOW())))
     LIMIT 1`
  );
  if (gameweek) {
    const matches = await queryAll<{ id: string }>(
      `SELECT m.id FROM match m JOIN matchday md ON m."matchdayId" = md.id WHERE md."gameweekId" = $1 ORDER BY m."kickoffTime"`,
      [gameweek.id]
    );
    // Each member predicts every match; points make totals strictly decreasing
    // (exacts = rank-from-bottom), so ranks 1..7 are deterministic + realistic.
    for (let r = 0; r < ranked.length; r++) {
      const userId = ranked[r]!;
      const exacts = Math.min(ranked.length - r, matches.length); // 7,6,5,4,3,2,1
      for (let j = 0; j < matches.length; j++) {
        const points = j < exacts ? 3 : 0;
        await query(
          `INSERT INTO prediction (id, "userId", "matchId", "leagueId", "homeScore", "awayScore", "hidden", "points", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, 2, 1, false, $5, NOW(), NOW())`,
          [crypto.randomUUID(), userId, matches[j]!.id, leagueId, points]
        );
      }
    }
    console.log(`[seed] ${ranked.length} players predicted ${matches.length} matches (GW ${gameweek.id}).`);
  } else {
    console.warn("[seed] no Premier League gameweek found — table will be empty until fixtures exist.");
  }

  // £5 GBP prize pool, default split. Provisional (freezes at the next deadline).
  await query(
    `INSERT INTO prize_pool (id, "leagueId", currency, "entryFeeMinor", "pctFirst", "pctSecond", "pctThird", "pctSecondLast", "createdAt", "updatedAt")
     VALUES ($1, $2, 'GBP', $3, 50, 25, 15, 10, NOW(), NOW())`,
    [crypto.randomUUID(), leagueId, ENTRY_FEE_MINOR]
  );

  console.log(`\n[seed] DONE.`);
  console.log(`  League:      ${LEAGUE_NAME}  (invite ${inviteCode})`);
  console.log(`  Members:     7 (you = admin, placed 2nd)`);
  console.log(`  Prize pool:  £5.00 × 7 = £35.00  →  1st £17.50 · 2nd £8.75 (you) · 3rd £5.25 · 2nd-last £3.50`);
  console.log(`  Log in as ${TARGET_EMAIL} and open the Test League. (Prize card needs the PP1a backend deployed.)`);
  await closePool();
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
