import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import crypto from "crypto";
import request from "supertest";
import { app } from "../app.js";
import { query, queryOne, initializeDatabase } from "../db.js";
import { notifyResults, notifyGameweekComplete } from "../services/notifications.js";
import { pushTestOutbox } from "../services/push.js";

// NS3 — results + gameweek-complete triggers.

let teamA: string;
let teamB: string;

async function signUpUser(tag: string): Promise<string> {
  const s = `${tag}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`.toLowerCase();
  const user = {
    name: "X", email: `${s}@example.com`, password: "ResultPass123!",
    firstName: "X", lastName: "Y", username: `${tag}_${Date.now() % 1e7}`.toLowerCase(),
  };
  const res = await request(app).post("/api/auth/sign-up/email").send(user);
  expect(res.status).toBe(200);
  const row = await queryOne<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [user.email]);
  return row!.id;
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

// A finished gameweek: 2 finished matches with real scores. Returns match ids.
async function seedFinishedGameweek(): Promise<{ gameweekId: string; matchIds: { id: string; hs: number; as: number }[] }> {
  const seasonId = crypto.randomUUID();
  await query(
    `INSERT INTO season (id, name, competition, "startDate", "endDate", "isCurrent", "createdAt", "updatedAt")
     VALUES ($1, '2025-26', 'premier_league', NOW(), NOW() + interval '60 days', false, NOW(), NOW())`,
    [seasonId]
  );
  const gameweekId = crypto.randomUUID();
  await query(
    `INSERT INTO gameweek (id, "seasonId", number, name, deadline, "startsAt", "endsAt", status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'GW', NOW() - interval '3 hours', NOW() - interval '2 hours', NOW() - interval '1 hour', 'completed', NOW(), NOW())`,
    [gameweekId, seasonId, Math.floor(Math.random() * 1000) + 1]
  );
  const matchdayId = crypto.randomUUID();
  await query(
    `INSERT INTO matchday (id, "gameweekId", date, "dayNumber", "createdAt", "updatedAt")
     VALUES ($1, $2, '2026-05-01', 1, NOW(), NOW())`,
    [matchdayId, gameweekId]
  );
  const matchIds: { id: string; hs: number; as: number }[] = [];
  const scores = [{ hs: 2, as: 1 }, { hs: 0, as: 0 }];
  for (const sc of scores) {
    const id = crypto.randomUUID();
    await query(
      `INSERT INTO match (id, "matchdayId", "homeTeamId", "awayTeamId", "kickoffTime", "homeScore", "awayScore", status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, NOW() - interval '2 hours', $5, $6, 'finished', NOW(), NOW())`,
      [id, matchdayId, teamA, teamB, sc.hs, sc.as]
    );
    matchIds.push({ id, hs: sc.hs, as: sc.as });
  }
  return { gameweekId, matchIds };
}

async function makeLeague(): Promise<string> {
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO league (id, name, type, "inviteCode", "createdBy", "createdAt", "updatedAt")
     VALUES ($1, 'Results League', 'premier_league', $2, NULL, NOW(), NOW())`,
    [id, crypto.randomBytes(4).toString("hex").toUpperCase()]
  );
  return id;
}

async function addMember(leagueId: string, userId: string): Promise<void> {
  await query(
    `INSERT INTO league_member (id, "leagueId", "userId", role, "joinedAt")
     VALUES ($1, $2, $3, 'member', NOW())`,
    [crypto.randomUUID(), leagueId, userId]
  );
}

// Predict + set points (as scoring would). points param = awarded points.
async function predict(leagueId: string, userId: string, matchId: string, hs: number, as: number, points: number): Promise<void> {
  await query(
    `INSERT INTO prediction (id, "userId", "matchId", "leagueId", "homeScore", "awayScore", points, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
    [crypto.randomUUID(), userId, matchId, leagueId, hs, as, points]
  );
}

describe("NS3 — results + gw-complete", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    await initializeDatabase();
    teamA = await makeTeam(`RH${Date.now() % 1000}`);
    teamB = await makeTeam(`RA${Date.now() % 1000}`);
  });

  beforeEach(() => {
    pushTestOutbox.length = 0;
  });

  it("batches a user's scored matches into one results push per league; dedups on re-run", async () => {
    const { matchIds } = await seedFinishedGameweek();
    const user = await signUpUser("res");
    const league = await makeLeague();
    await addMember(league, user);
    // predicted both matches; exact on #1 (3 pts), miss on #2 (0)
    await predict(league, user, matchIds[0]!.id, 2, 1, 3);
    await predict(league, user, matchIds[1]!.id, 1, 0, 0);

    await notifyResults(matchIds.map((m) => m.id));
    const mine = pushTestOutbox.filter((p) => p.userId === user);
    expect(mine.length).toBe(1); // batched, not 2
    expect(mine[0]!.kind).toBe("results");

    // Re-run (idempotent re-score) → nothing new
    pushTestOutbox.length = 0;
    await notifyResults(matchIds.map((m) => m.id));
    expect(pushTestOutbox.filter((p) => p.userId === user).length).toBe(0);
  });

  it("fires gw_complete once per member when the gameweek is fully finished", async () => {
    const { gameweekId, matchIds } = await seedFinishedGameweek();
    const a = await signUpUser("gwa");
    const b = await signUpUser("gwb");
    const league = await makeLeague();
    await addMember(league, a);
    await addMember(league, b);
    await predict(league, a, matchIds[0]!.id, 2, 1, 3);
    await predict(league, b, matchIds[0]!.id, 0, 0, 1);

    await notifyGameweekComplete();
    // Assert per-gameweek via push_log (the shared test DB holds other finished
    // gameweeks too, so outbox totals aren't a clean signal). Exactly one row
    // per member for THIS gameweek+league.
    const rowsFor = async () =>
      (await queryOne<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM push_log
         WHERE kind = 'gw_complete' AND subject_id = $1 AND league_id = $2`,
        [gameweekId, league]
      ))?.n;
    expect(await rowsFor()).toBe("2"); // a + b
    // both members got a gw_complete push in this run
    expect(pushTestOutbox.some((p) => p.userId === a && p.kind === "gw_complete")).toBe(true);
    expect(pushTestOutbox.some((p) => p.userId === b && p.kind === "gw_complete")).toBe(true);

    // Re-run → dedup: no new log rows, no new sends this run
    pushTestOutbox.length = 0;
    await notifyGameweekComplete();
    expect(await rowsFor()).toBe("2");
    expect(pushTestOutbox.some((p) => p.userId === a || p.userId === b)).toBe(false);
  });
});
