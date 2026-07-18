/**
 * DESTRUCTIVE demo seed for screenshots + App Review.
 *
 * Wipes EVERY league (and its members, predictions, prize pools, cached scores),
 * then builds two populated leagues around a "hero" account so every screen looks
 * full: a Premier League "Sunday League" (hero placed 2nd) and — if UCL fixtures
 * exist — a "Champions Predictor". Each member predicts the played gameweeks with
 * a realistic spread of points (so the table is ordered and the settled-prediction
 * badges show) plus the upcoming gameweek (so the predict pane is alive).
 *
 *   HERO_EMAIL=you@example.com CONFIRM=WIPE DATABASE_URL=<prod-url> npx tsx src/scripts/seed-demo.ts
 *
 * HERO_EMAIL must already be a signed-up account (the one you screenshot with).
 * Requires CONFIRM=WIPE (guards against accidental wipes). Idempotent: re-running
 * wipes and rebuilds; demo players are reused by email (no duplicate signups).
 */
import crypto from "crypto";
import { auth } from "../auth.js";
import { initializeDatabase, closePool, query, queryOne, queryAll } from "../db.js";

const HERO_EMAIL = process.env.HERO_EMAIL || process.argv[2];
const TEST_PASSWORD = process.env.TEST_PASSWORD || "DemoPlayer!2026";

const PLAYERS = [
  { name: "Jordan Hughes", username: "jordanh" },
  { name: "Sam Okafor", username: "samok" },
  { name: "Marcus Bello", username: "marcusb" },
  { name: "Danny Fisher", username: "dannyf" },
  { name: "Alex Newton", username: "alexn" },
  { name: "Chris Pratt", username: "chrisp" },
  { name: "Omar Haddad", username: "omarh" },
  { name: "Leo Fernandez", username: "leof" },
  { name: "Nathan Cole", username: "nathanc" },
];

const BIAS = [0, 0, 1, 1, 1, 2, 2, 3, 4]; // realistic scoreline distribution
const randScore = () => ({
  home: BIAS[Math.floor(Math.random() * BIAS.length)]!,
  away: BIAS[Math.floor(Math.random() * BIAS.length)]!,
});

async function ensureUser(email: string, name: string, username: string): Promise<string> {
  const existing = await queryOne<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [email]);
  if (existing) return existing.id;
  await auth.api.signUpEmail({
    body: {
      email, password: TEST_PASSWORD, name,
      firstName: name.split(" ")[0], lastName: name.split(" ").slice(1).join(" ") || "Demo",
      username,
    } as never,
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

// Build a populated league. `ranked` = member ids in final table order (index 0 =
// top). Returns false (skips) when the competition has no fixtures.
async function buildLeague(name: string, competition: string, ranked: string[], adminId: string): Promise<boolean> {
  const gws = await queryAll<{ id: string; deadline: string }>(
    `SELECT g.id, g.deadline FROM gameweek g
       JOIN season s ON g."seasonId" = s.id
      WHERE s.competition = $1 AND s."isCurrent" = true
      ORDER BY g.deadline ASC`,
    [competition]
  );
  if (gws.length === 0) {
    console.warn(`[demo] no ${competition} fixtures — skipping "${name}".`);
    return false;
  }

  const nowMs = Date.now();
  const pastGws = gws.filter((g) => new Date(g.deadline).getTime() < nowMs);
  const upcomingGw = gws.find((g) => new Date(g.deadline).getTime() >= nowMs);

  const matchesOf = async (gwId: string) =>
    queryAll<{ id: string }>(
      `SELECT m.id FROM match m JOIN matchday md ON m."matchdayId" = md.id WHERE md."gameweekId" = $1 ORDER BY m."kickoffTime"`,
      [gwId]
    );

  const pastMatches: { id: string }[] = [];
  for (const g of pastGws) pastMatches.push(...(await matchesOf(g.id)));
  const upMatches = upcomingGw ? await matchesOf(upcomingGw.id) : [];

  // If the season hasn't kicked off, score the nearest gameweek so the table isn't empty.
  const scoringMatches = pastMatches.length ? pastMatches : upMatches;
  const upcomingNoPoints = pastMatches.length ? upMatches : [];

  const leagueId = crypto.randomUUID();
  const now = new Date().toISOString();
  await query(
    `INSERT INTO league (id, name, type, "inviteCode", "createdBy", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $6)`,
    [leagueId, name, competition, crypto.randomBytes(4).toString("hex").toUpperCase(), adminId, now]
  );
  for (const uid of ranked) {
    await query(
      `INSERT INTO league_member (id, "leagueId", "userId", role, "joinedAt") VALUES ($1, $2, $3, $4, $5)`,
      [crypto.randomUUID(), leagueId, uid, uid === adminId ? "admin" : "member", now]
    );
  }

  const S = scoringMatches.length;
  for (let idx = 0; idx < ranked.length; idx++) {
    const uid = ranked[idx]!;
    // Target total scales to available matches: ~70% of max at the top down to ~10%.
    const frac = ranked.length > 1 ? idx / (ranked.length - 1) : 0;
    const target = Math.round(3 * S * (0.7 - 0.6 * frac));
    const exacts = Math.floor(target / 3);
    const corrects = target - exacts * 3; // 0,1,2 → a couple of 1-pointers
    for (let mi = 0; mi < S; mi++) {
      const pts = mi < exacts ? 3 : mi < exacts + corrects ? 1 : 0;
      const { home, away } = randScore();
      await insertPrediction(uid, scoringMatches[mi]!.id, leagueId, home, away, pts);
    }
    for (const m of upcomingNoPoints) {
      const { home, away } = randScore();
      await insertPrediction(uid, m.id, leagueId, home, away, null);
    }
  }
  console.log(`[demo] "${name}" (${competition}): ${ranked.length} players · ${S} scored + ${upcomingNoPoints.length} upcoming matches each.`);
  return true;
}

// hero placed at `heroRank` (1-based) among the members.
function order(heroId: string, others: string[], heroRank: number): string[] {
  const ranked: string[] = [];
  let oi = 0;
  for (let r = 1; r <= others.length + 1; r++) ranked.push(r === heroRank ? heroId : others[oi++]!);
  return ranked;
}

async function main() {
  if (!HERO_EMAIL) {
    console.error("Set HERO_EMAIL to the account you screenshot with, e.g.\n  HERO_EMAIL=you@example.com CONFIRM=WIPE DATABASE_URL=<url> npx tsx src/scripts/seed-demo.ts");
    process.exit(1);
  }
  if (process.env.CONFIRM !== "WIPE") {
    console.error("This DELETES every league. Re-run with CONFIRM=WIPE to proceed.");
    process.exit(1);
  }
  await initializeDatabase();

  const hero = await queryOne<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [HERO_EMAIL]);
  if (!hero) {
    console.error(`No account for ${HERO_EMAIL}. Sign up with that email in the app first, then re-run.`);
    await closePool();
    process.exit(1);
  }

  await wipeAllLeagues();
  console.log("[demo] wiped all leagues.");

  const plTeams = await queryAll<{ id: string }>(`SELECT id FROM team WHERE competition = 'premier_league' ORDER BY name`);
  const playerIds: string[] = [];
  for (let i = 0; i < PLAYERS.length; i++) {
    const p = PLAYERS[i]!;
    const id = await ensureUser(`demo_${p.username}@scorecast.test`, p.name, p.username);
    await query(`UPDATE "user" SET "emailVerified" = true WHERE id = $1`, [id]);
    if (plTeams[i % Math.max(plTeams.length, 1)]) {
      await query(`UPDATE "user" SET "favoriteTeamId" = $1 WHERE id = $2`, [plTeams[i % plTeams.length]!.id, id]);
    }
    playerIds.push(id);
  }
  if (plTeams[0]) await query(`UPDATE "user" SET "favoriteTeamId" = COALESCE("favoriteTeamId", $1) WHERE id = $2`, [plTeams[0].id, hero.id]);

  // PL: hero + 8 players, hero 2nd. UCL: hero + 5 players, hero 3rd (if fixtures exist).
  await buildLeague("Sunday League", "premier_league", order(hero.id, playerIds.slice(0, 8), 2), hero.id);
  await buildLeague("Champions Predictor", "champions_league", order(hero.id, playerIds.slice(0, 5), 3), hero.id);

  console.log(`\n[demo] DONE. Log in as ${HERO_EMAIL} to screenshot. (Prize pool is feature-flagged off, so nothing gambling-related shows.)`);
  await closePool();
}

main().catch((err) => {
  console.error("[demo] failed:", err);
  process.exit(1);
});
