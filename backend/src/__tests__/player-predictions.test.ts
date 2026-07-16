import { describe, it, expect, beforeAll } from "vitest";
import crypto from "crypto";
import request from "supertest";
import { app } from "../app.js";
import { query, queryOne, initializeDatabase } from "../db.js";

// View-a-player's-predictions endpoint + the hidePredictions privacy gate.

let teamA: string;
let teamB: string;

async function signUpVerified(tag: string): Promise<{ id: string; cookie: string }> {
  const s = `${tag}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`.toLowerCase();
  const user = {
    name: "P Tester", email: `${s}@example.com`, password: "PlayerPass123!",
    firstName: "P", lastName: "Tester", username: `${tag}_${Date.now() % 1e7}`.toLowerCase(),
  };
  expect((await request(app).post("/api/auth/sign-up/email").send(user)).status).toBe(200);
  await query(`UPDATE "user" SET "emailVerified" = true WHERE email = $1`, [user.email]);
  const si = await request(app).post("/api/auth/sign-in/email").send({ email: user.email, password: user.password });
  expect(si.status).toBe(200);
  const id = (await queryOne<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [user.email]))!.id;
  const cookie = (Array.isArray(si.headers["set-cookie"]) ? si.headers["set-cookie"] : [si.headers["set-cookie"]]).join("; ");
  return { id, cookie };
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

async function seedGameweek(deadlineInterval: string): Promise<{ gameweekId: string; matchIds: string[] }> {
  const seasonId = crypto.randomUUID();
  await query(
    `INSERT INTO season (id, name, competition, "startDate", "endDate", "isCurrent", "createdAt", "updatedAt")
     VALUES ($1, '2025-26', 'premier_league', NOW(), NOW() + interval '60 days', false, NOW(), NOW())`,
    [seasonId]
  );
  const gameweekId = crypto.randomUUID();
  await query(
    `INSERT INTO gameweek (id, "seasonId", number, name, deadline, "startsAt", "endsAt", status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'GW', NOW() + $4::interval, NOW() + $4::interval, NOW() + $4::interval + interval '2 hours', 'upcoming', NOW(), NOW())`,
    [gameweekId, seasonId, Math.floor(Math.random() * 1000) + 1, deadlineInterval]
  );
  const matchdayId = crypto.randomUUID();
  await query(
    `INSERT INTO matchday (id, "gameweekId", date, "dayNumber", "createdAt", "updatedAt") VALUES ($1, $2, '2026-05-01', 1, NOW(), NOW())`,
    [matchdayId, gameweekId]
  );
  const matchIds: string[] = [];
  for (let i = 0; i < 2; i++) {
    const id = crypto.randomUUID();
    await query(
      `INSERT INTO match (id, "matchdayId", "homeTeamId", "awayTeamId", "kickoffTime", status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, NOW() + interval '25 hours', 'scheduled', NOW(), NOW())`,
      [id, matchdayId, teamA, teamB]
    );
    matchIds.push(id);
  }
  return { gameweekId, matchIds };
}

async function makeLeague(hide: boolean): Promise<string> {
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO league (id, name, type, "inviteCode", "createdBy", "hidePredictions", "createdAt", "updatedAt")
     VALUES ($1, 'PP League', 'premier_league', $2, NULL, $3, NOW(), NOW())`,
    [id, crypto.randomBytes(4).toString("hex").toUpperCase(), hide]
  );
  return id;
}

async function addMember(leagueId: string, userId: string) {
  await query(
    `INSERT INTO league_member (id, "leagueId", "userId", role, "joinedAt") VALUES ($1, $2, $3, 'member', NOW())`,
    [crypto.randomUUID(), leagueId, userId]
  );
}

async function predict(leagueId: string, userId: string, matchIds: string[]) {
  for (const m of matchIds) {
    await query(
      `INSERT INTO prediction (id, "userId", "matchId", "leagueId", "homeScore", "awayScore", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 2, 1, NOW(), NOW())`,
      [crypto.randomUUID(), userId, m, leagueId]
    );
  }
}

const url = (l: string, g: string, u: string) => `/api/predictions/${l}/gameweek/${g}/user/${u}`;

describe("view player predictions + hide gate", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    await initializeDatabase();
    teamA = await makeTeam(`PH${Date.now() % 1000}`);
    teamB = await makeTeam(`PA${Date.now() % 1000}`);
  });

  it("hidden league, deadline in future: others 403 locked, own visible", async () => {
    const a = await signUpVerified("ha");
    const b = await signUpVerified("hb");
    const { gameweekId, matchIds } = await seedGameweek("10 hours");
    const league = await makeLeague(true);
    await addMember(league, a.id);
    await addMember(league, b.id);
    await predict(league, b.id, matchIds);
    await predict(league, a.id, matchIds);

    const others = await request(app).get(url(league, gameweekId, b.id)).set("Cookie", a.cookie);
    expect(others.status).toBe(403);
    expect(others.body.locked).toBe(true);

    const own = await request(app).get(url(league, gameweekId, a.id)).set("Cookie", a.cookie);
    expect(own.status).toBe(200);
    expect(own.body.length).toBe(2);
  });

  it("hidden league, deadline passed: others visible", async () => {
    const a = await signUpVerified("pa");
    const b = await signUpVerified("pb");
    const { gameweekId, matchIds } = await seedGameweek("-2 hours"); // already passed
    const league = await makeLeague(true);
    await addMember(league, a.id);
    await addMember(league, b.id);
    await predict(league, b.id, matchIds);

    const res = await request(app).get(url(league, gameweekId, b.id)).set("Cookie", a.cookie);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it("non-hidden league: others visible before deadline", async () => {
    const a = await signUpVerified("na");
    const b = await signUpVerified("nb");
    const { gameweekId, matchIds } = await seedGameweek("10 hours");
    const league = await makeLeague(false);
    await addMember(league, a.id);
    await addMember(league, b.id);
    await predict(league, b.id, matchIds);

    const res = await request(app).get(url(league, gameweekId, b.id)).set("Cookie", a.cookie);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it("non-member caller is blocked", async () => {
    const a = await signUpVerified("xa");
    const b = await signUpVerified("xb");
    const { gameweekId } = await seedGameweek("-2 hours");
    const league = await makeLeague(false);
    await addMember(league, b.id);
    // a is NOT a member
    const res = await request(app).get(url(league, gameweekId, b.id)).set("Cookie", a.cookie);
    expect(res.status).toBe(403);
  });
});
