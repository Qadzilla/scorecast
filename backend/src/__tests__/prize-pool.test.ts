import { describe, it, expect, beforeAll } from "vitest";
import crypto from "crypto";
import request from "supertest";
import { app } from "../app.js";
import { query, queryOne, initializeDatabase } from "../db.js";

// Prize pool (PP1a): config CRUD + payout math + freeze. Money in minor units.

let teamA: string;
let teamB: string;
let matchId: string; // a premier_league match, for awarding points
let admin: { id: string; cookie: string; email: string };

const url = (leagueId: string) => `/api/leagues/${leagueId}/prize-pool`;
const DEFAULT_PCT = { first: 50, second: 25, third: 15, secondLast: 10 };

async function signUp(tag: string): Promise<{ id: string; cookie: string; email: string }> {
  const s = `${tag}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`.toLowerCase();
  const email = `${s}@example.com`;
  const user = {
    name: "PP Tester", email, password: "PrizePass123!",
    firstName: "P", lastName: "P", username: `${tag}_${Date.now() % 1e7}`.toLowerCase(),
  };
  expect((await request(app).post("/api/auth/sign-up/email").send(user)).status).toBe(200);
  await query(`UPDATE "user" SET "emailVerified" = true WHERE email = $1`, [email]);
  const si = await request(app).post("/api/auth/sign-in/email").send({ email, password: user.password });
  expect(si.status).toBe(200);
  const id = (await queryOne<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [email]))!.id;
  const cookie = (Array.isArray(si.headers["set-cookie"]) ? si.headers["set-cookie"] : [si.headers["set-cookie"]]).join("; ");
  return { id, cookie, email };
}

async function makeTeam(code: string): Promise<string> {
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO team (id, name, "shortName", code, competition, "createdAt", "updatedAt")
     VALUES ($1, $2, $2, $3, 'premier_league', NOW(), NOW())`,
    [id, `Team ${code}`, code]
  );
  return id;
}

async function seedMatch(competition: string, deadlineInterval: string, isCurrent: boolean) {
  const seasonId = crypto.randomUUID();
  await query(
    `INSERT INTO season (id, name, competition, "startDate", "endDate", "isCurrent", "createdAt", "updatedAt")
     VALUES ($1, '25-26', $2, NOW(), NOW() + interval '60 days', $3, NOW(), NOW())`,
    [seasonId, competition, isCurrent]
  );
  const gameweekId = crypto.randomUUID();
  await query(
    `INSERT INTO gameweek (id, "seasonId", number, name, deadline, "startsAt", "endsAt", status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'GW', NOW() + $4::interval, NOW() + $4::interval, NOW() + $4::interval + interval '2 hours', 'upcoming', NOW(), NOW())`,
    [gameweekId, seasonId, Math.floor(Math.random() * 1000000) + 1, deadlineInterval]
  );
  const matchdayId = crypto.randomUUID();
  await query(
    `INSERT INTO matchday (id, "gameweekId", date, "dayNumber", "createdAt", "updatedAt") VALUES ($1, $2, '2026-05-01', 1, NOW(), NOW())`,
    [matchdayId, gameweekId]
  );
  const mId = crypto.randomUUID();
  await query(
    `INSERT INTO match (id, "matchdayId", "homeTeamId", "awayTeamId", "kickoffTime", status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, NOW() + interval '25 hours', 'scheduled', NOW(), NOW())`,
    [mId, matchdayId, teamA, teamB]
  );
  return { seasonId, gameweekId, matchId: mId };
}

async function makeLeague(type = "premier_league"): Promise<string> {
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO league (id, name, type, "inviteCode", "createdBy", "createdAt", "updatedAt")
     VALUES ($1, 'PP League', $2, $3, NULL, NOW(), NOW())`,
    [id, type, crypto.randomBytes(4).toString("hex").toUpperCase()]
  );
  return id;
}

async function addMember(leagueId: string, userId: string, joinedAtSql = "NOW()") {
  await query(
    `INSERT INTO league_member (id, "leagueId", "userId", role, "joinedAt") VALUES ($1, $2, $3, 'member', ${joinedAtSql})`,
    [crypto.randomUUID(), leagueId, userId]
  );
}

// A scored prediction, points set directly to control leaderboard order.
async function award(leagueId: string, userId: string, points: number) {
  await query(
    `INSERT INTO prediction (id, "userId", "matchId", "leagueId", "homeScore", "awayScore", "hidden", "points", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, 1, 0, false, $5, NOW(), NOW())`,
    [crypto.randomUUID(), userId, matchId, leagueId, points]
  );
}

// Create N members with strictly-decreasing points → deterministic ranks 1..N.
async function membersRanked(leagueId: string, n: number) {
  const users: { id: string; cookie: string }[] = [];
  for (let i = 0; i < n; i++) {
    const u = await signUp(`m${i}`);
    await addMember(leagueId, u.id);
    await award(leagueId, u.id, (n - i) * 2); // i=0 highest
    users.push(u);
  }
  return users; // index 0 = rank 1
}

async function putPool(leagueId: string, cookie: string, body: object) {
  return request(app).put(url(leagueId)).set("Cookie", cookie).send(body);
}

describe("prize pool", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    await initializeDatabase();
    teamA = await makeTeam(`PPA${Date.now() % 1000}`);
    teamB = await makeTeam(`PPB${Date.now() % 1000}`);
    ({ matchId } = await seedMatch("premier_league", "10 hours", false));
    admin = await signUp("ppadmin");
    process.env.ADMIN_EMAILS = admin.email;
  });

  it("non-member is blocked from reading the pool", async () => {
    const league = await makeLeague();
    const outsider = await signUp("out");
    const res = await request(app).get(url(league)).set("Cookie", outsider.cookie);
    expect(res.status).toBe(403);
  });

  it("returns null when the league has no pool", async () => {
    const league = await makeLeague();
    await addMember(league, admin.id);
    const res = await request(app).get(url(league)).set("Cookie", admin.cookie);
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it("non-admin cannot set the pool", async () => {
    const league = await makeLeague();
    const notAdmin = await signUp("na");
    const res = await putPool(league, notAdmin.cookie, { currency: "GBP", entryFeeMinor: 500, pct: DEFAULT_PCT });
    expect(res.status).toBe(403);
  });

  it("computes payouts + occupants for a 5-player pool (default split)", async () => {
    const league = await makeLeague();
    const users = await membersRanked(league, 5); // ranks 1..5, points 10,8,6,4,2

    const res = await putPool(league, admin.cookie, { currency: "GBP", entryFeeMinor: 500, pct: DEFAULT_PCT });
    expect(res.status).toBe(200);
    expect(res.body.poolMinor).toBe(2500); // 500 * 5
    expect(res.body.memberCount).toBe(5);
    expect(res.body.frozen).toBe(false);
    expect(res.body.payouts.first).toEqual({ amountMinor: 1250, userId: users[0]!.id });
    expect(res.body.payouts.second).toEqual({ amountMinor: 625, userId: users[1]!.id });
    expect(res.body.payouts.third).toEqual({ amountMinor: 375, userId: users[2]!.id });
    // 2nd-last = rank 4 (index N-2 = 3)
    expect(res.body.payouts.secondLast).toEqual({ amountMinor: 250, userId: users[3]!.id });
    // last place (rank 5) is not paid
    expect(res.body.memberCount).toBe(5);
  });

  it("renormalises + drops 2nd-last below 5 players, dust to 1st", async () => {
    const league = await makeLeague();
    await membersRanked(league, 4);

    const res = await putPool(league, admin.cookie, { currency: "USD", entryFeeMinor: 500, pct: DEFAULT_PCT });
    expect(res.status).toBe(200);
    expect(res.body.poolMinor).toBe(2000); // 500 * 4
    // active weights 50/25/15 (sum 90): floors 1111/555/333 = 1999, dust 1 -> 1st
    expect(res.body.payouts.first.amountMinor).toBe(1112);
    expect(res.body.payouts.second.amountMinor).toBe(555);
    expect(res.body.payouts.third.amountMinor).toBe(333);
    expect(res.body.payouts.secondLast).toBeNull();
    // payouts sum exactly to the pool
    const sum = res.body.payouts.first.amountMinor + res.body.payouts.second.amountMinor + res.body.payouts.third.amountMinor;
    expect(sum).toBe(2000);
  });

  it("rejects invalid splits", async () => {
    const league = await makeLeague();
    const bad = [
      { currency: "GBP", entryFeeMinor: 500, pct: { first: 50, second: 25, third: 15, secondLast: 5 } }, // sums 95
      { currency: "GBP", entryFeeMinor: 500, pct: { first: 20, second: 30, third: 25, secondLast: 25 } }, // not non-increasing
      { currency: "BTC", entryFeeMinor: 500, pct: DEFAULT_PCT }, // bad currency
      { currency: "GBP", entryFeeMinor: 0, pct: DEFAULT_PCT }, // fee not positive
    ];
    for (const body of bad) {
      const res = await putPool(league, admin.cookie, body);
      expect(res.status).toBe(400);
    }
  });

  it("freezes at the first deadline and then locks edits", async () => {
    // isolate: clear any current UCL season, then a past-deadline current one
    await query(`UPDATE season SET "isCurrent" = false WHERE competition = 'champions_league'`);
    await seedMatch("champions_league", "-1 hours", true); // deadline 1h ago

    const league = await makeLeague("champions_league");
    for (let i = 0; i < 5; i++) {
      const u = await signUp(`fz${i}`);
      await addMember(league, u.id, "NOW() - interval '2 hours'"); // joined before the deadline
    }
    await addMember(league, admin.id); // joins now (after deadline) so GET is authorized but not pool-eligible

    // set the pool, then backdate its creation so the past deadline counts as "GW1"
    expect((await putPool(league, admin.cookie, { currency: "JOD", entryFeeMinor: 5000, pct: DEFAULT_PCT })).status).toBe(200);
    await query(`UPDATE prize_pool SET "createdAt" = NOW() - interval '3 hours' WHERE "leagueId" = $1`, [league]);

    const res = await request(app).get(url(league)).set("Cookie", admin.cookie);
    expect(res.status).toBe(200);
    expect(res.body.frozen).toBe(true);
    expect(res.body.poolMinor).toBe(25000); // 5000 * 5, frozen
    expect(res.body.memberCount).toBe(5);

    // editing a frozen pool is blocked
    const locked = await putPool(league, admin.cookie, { currency: "JOD", entryFeeMinor: 9000, pct: DEFAULT_PCT });
    expect(locked.status).toBe(400);
  });
});
