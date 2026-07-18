/**
 * DESTRUCTIVE demo seed for screenshots + App Review.
 *
 * Wipes EVERY league, then builds hand-tuned populated leagues around a "hero"
 * account (renamed to "ScoreCast" for the shots): a Premier League "Sunday League"
 * (9 players, hero 2nd) and a "Champions Predictor" (6 players, hero 2nd) — the
 * latter only if UCL fixtures exist (run src/scripts/sync-cl.ts first).
 *
 * Each row's points are EXACT (E exacts × 3 + C correct-results × 1), so the table
 * is deterministic and the settled-prediction badges look real.
 *
 *   HERO_EMAIL=you@example.com CONFIRM=WIPE railway run npm run seed:demo
 *
 * HERO_EMAIL must already be a signed-up account. Requires CONFIRM=WIPE. Idempotent.
 */
import crypto from "crypto";
import { auth } from "../auth.js";
import { initializeDatabase, closePool, query, queryOne, queryAll } from "../db.js";

const HERO_EMAIL = process.env.HERO_EMAIL || process.argv[2];
const TEST_PASSWORD = process.env.TEST_PASSWORD || "DemoPlayer!2026";
const HERO_NAME = "ScoreCast";
const HERO_USERNAME = "scorecast";

// Demo players (created once, reused by email). `team` is matched against the PL
// team names for a varied set of crests.
const DEMO = [
  { username: "tommyw", name: "Tommy Walsh", team: "Arsenal" },
  { username: "callum", name: "Callum Reid", team: "Liverpool" },
  { username: "femi", name: "Femi Adeyemi", team: "Manchester City" },
  { username: "devsharma", name: "Dev Sharma", team: "Tottenham" },
  { username: "marcor", name: "Marco Rossi", team: "Chelsea" },
  { username: "jakeb", name: "Jake Brennan", team: "Newcastle" },
  { username: "benc", name: "Ben Carter", team: "Aston Villa" },
  { username: "ronank", name: "Ronan Kelly", team: "Manchester United" },
];

// Final tables in rank order. E = exact scores (3 pts), C = correct results (1 pt).
// "hero" is the logged-in account — 3rd in the PL, 1st in the UCL.
const SUNDAY: { who: string; E: number; C: number }[] = [
  { who: "tommyw", E: 6, C: 2 }, //    20
  { who: "callum", E: 5, C: 3 }, //    18
  { who: "hero", E: 4, C: 4 }, //      16  ← you, 3rd
  { who: "femi", E: 4, C: 3 }, //      15
  { who: "devsharma", E: 3, C: 4 }, // 13
  { who: "marcor", E: 3, C: 2 }, //    11
  { who: "jakeb", E: 2, C: 4 }, //     10
  { who: "benc", E: 2, C: 1 }, //       7
  { who: "ronank", E: 1, C: 2 }, //     5
];
const UCL: { who: string; E: number; C: number }[] = [
  { who: "hero", E: 3, C: 3 }, //      12  ← you, 1st
  { who: "femi", E: 3, C: 1 }, //      10
  { who: "callum", E: 2, C: 2 }, //     8
  { who: "devsharma", E: 1, C: 3 }, //  6
  { who: "tommyw", E: 1, C: 2 }, //     5
  { who: "marcor", E: 1, C: 0 }, //     3
];

const BIAS = [0, 0, 1, 1, 1, 2, 2, 3];
const randScore = () => ({ home: BIAS[Math.floor(Math.random() * BIAS.length)]!, away: BIAS[Math.floor(Math.random() * BIAS.length)]! });

async function ensureUser(email: string, name: string, username: string): Promise<string> {
  const existing = await queryOne<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [email]);
  if (existing) return existing.id;
  await auth.api.signUpEmail({
    body: { email, password: TEST_PASSWORD, name, firstName: name.split(" ")[0], lastName: name.split(" ").slice(1).join(" ") || "Demo", username } as never,
  });
  const created = await queryOne<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [email]);
  if (!created) throw new Error(`failed to create ${email}`);
  return created.id;
}

async function wipeAllLeagues() {
  for (const t of ["prediction", "user_gameweek_score", "user_league_standing", "league_member", "prize_pool"]) {
    await query(`DELETE FROM ${t}`);
  }
  await query(`DELETE FROM league`);
}

async function insertPrediction(userId: string, matchId: string, leagueId: string, home: number, away: number, points: number | null) {
  await query(
    `INSERT INTO prediction (id, "userId", "matchId", "leagueId", "homeScore", "awayScore", "hidden", "points", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, false, $7, NOW(), NOW())`,
    [crypto.randomUUID(), userId, matchId, leagueId, home, away, points]
  );
}

// Build a league from rank-ordered rows. Each row gets E predictions worth 3 and
// C worth 1 on the played matches, the rest 0 → exact totals.
async function buildLeague(name: string, competition: string, rows: { userId: string; E: number; C: number }[], adminId: string): Promise<boolean> {
  const gws = await queryAll<{ id: string; deadline: string }>(
    `SELECT g.id, g.deadline FROM gameweek g JOIN season s ON g."seasonId" = s.id
      WHERE s.competition = $1 AND s."isCurrent" = true ORDER BY g.deadline ASC`,
    [competition]
  );
  if (gws.length === 0) {
    console.warn(`[demo] no ${competition} fixtures — skipping "${name}". (Run sync-cl.ts for UCL.)`);
    return false;
  }

  const nowMs = Date.now();
  const pastGws = gws.filter((g) => new Date(g.deadline).getTime() < nowMs);
  const upcomingGw = gws.find((g) => new Date(g.deadline).getTime() >= nowMs);
  const matchesOf = async (gwId: string) =>
    queryAll<{ id: string }>(`SELECT m.id FROM match m JOIN matchday md ON m."matchdayId" = md.id WHERE md."gameweekId" = $1 ORDER BY m."kickoffTime"`, [gwId]);

  const pastMatches: { id: string }[] = [];
  for (const g of pastGws) pastMatches.push(...(await matchesOf(g.id)));
  const upMatches = upcomingGw ? await matchesOf(upcomingGw.id) : [];
  const scoringMatches = pastMatches.length ? pastMatches : upMatches;
  const upcomingNoPoints = pastMatches.length ? upMatches : [];
  const S = scoringMatches.length;

  const leagueId = crypto.randomUUID();
  const now = new Date().toISOString();
  await query(
    `INSERT INTO league (id, name, type, "inviteCode", "createdBy", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $6)`,
    [leagueId, name, competition, crypto.randomBytes(4).toString("hex").toUpperCase(), adminId, now]
  );
  for (const row of rows) {
    await query(
      `INSERT INTO league_member (id, "leagueId", "userId", role, "joinedAt") VALUES ($1, $2, $3, $4, $5)`,
      [crypto.randomUUID(), leagueId, row.userId, row.userId === adminId ? "admin" : "member", now]
    );
  }
  for (const row of rows) {
    for (let mi = 0; mi < S; mi++) {
      const pts = mi < row.E ? 3 : mi < row.E + row.C ? 1 : 0;
      const { home, away } = randScore();
      await insertPrediction(row.userId, scoringMatches[mi]!.id, leagueId, home, away, pts);
    }
    for (const m of upcomingNoPoints) {
      const { home, away } = randScore();
      await insertPrediction(row.userId, m.id, leagueId, home, away, null);
    }
  }
  console.log(`[demo] "${name}" (${competition}): ${rows.length} players · ${S} scored matches each.`);
  return true;
}

async function main() {
  if (!HERO_EMAIL) {
    console.error("Set HERO_EMAIL, e.g.\n  HERO_EMAIL=you@example.com CONFIRM=WIPE railway run npm run seed:demo");
    process.exit(1);
  }
  if (process.env.CONFIRM !== "WIPE") {
    console.error("This DELETES every league. Re-run with CONFIRM=WIPE to proceed.");
    process.exit(1);
  }
  await initializeDatabase();

  const hero = await queryOne<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [HERO_EMAIL]);
  if (!hero) {
    console.error(`No account for ${HERO_EMAIL}. Sign up with that email first.`);
    await closePool();
    process.exit(1);
  }

  await wipeAllLeagues();
  console.log("[demo] wiped all leagues.");

  // Rename the hero account to "ScoreCast" for the shots (no "qadzilla").
  let heroUsername = HERO_USERNAME;
  const taken = await queryOne<{ id: string }>(`SELECT id FROM "user" WHERE username = $1 AND id <> $2`, [heroUsername, hero.id]);
  if (taken) heroUsername = `${HERO_USERNAME}1`;
  await query(`UPDATE "user" SET name = $1, username = $2 WHERE id = $3`, [HERO_NAME, heroUsername, hero.id]);

  const plTeams = await queryAll<{ id: string }>(`SELECT id FROM team WHERE competition = 'premier_league' ORDER BY name`);
  // Create demo players with matched crests.
  const idByUsername: Record<string, string> = {};
  for (let i = 0; i < DEMO.length; i++) {
    const p = DEMO[i]!;
    const id = await ensureUser(`demo_${p.username}@scorecast.test`, p.name, p.username);
    await query(`UPDATE "user" SET "emailVerified" = true WHERE id = $1`, [id]);
    const team = await queryOne<{ id: string }>(
      `SELECT id FROM team WHERE competition = 'premier_league' AND name ILIKE '%' || $1 || '%' LIMIT 1`,
      [p.team]
    );
    const teamId = team?.id ?? plTeams[i % Math.max(plTeams.length, 1)]?.id;
    if (teamId) await query(`UPDATE "user" SET "favoriteTeamId" = $1 WHERE id = $2`, [teamId, id]);
    idByUsername[p.username] = id;
  }
  if (plTeams[0]) await query(`UPDATE "user" SET "favoriteTeamId" = COALESCE("favoriteTeamId", $1) WHERE id = $2`, [plTeams[0].id, hero.id]);

  const resolve = (rows: { who: string; E: number; C: number }[]) =>
    rows.map((r) => ({ userId: r.who === "hero" ? hero.id : idByUsername[r.who]!, E: r.E, C: r.C }));

  await buildLeague("Sunday League", "premier_league", resolve(SUNDAY), hero.id);
  await buildLeague("Champions Predictor", "champions_league", resolve(UCL), hero.id);

  console.log(`\n[demo] DONE. Log in as ${HERO_EMAIL} (shown as "${HERO_NAME}" / @${heroUsername}) to screenshot.`);
  await closePool();
}

main().catch((err) => {
  console.error("[demo] failed:", err);
  process.exit(1);
});
