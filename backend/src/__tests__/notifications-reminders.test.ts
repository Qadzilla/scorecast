import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import crypto from "crypto";
import request from "supertest";
import { app } from "../app.js";
import { query, queryOne, initializeDatabase } from "../db.js";
import { runDeadlineReminders } from "../services/notifications.js";
import { pushTestOutbox } from "../services/push.js";

// NS2 — deadline reminder cron. Verifies only unsubmitted members are notified,
// once each, in the right window, with dedup on re-run.

let teamA: string;
let teamB: string;

async function signUpUser(tag: string): Promise<string> {
  const s = `${tag}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`.toLowerCase();
  const user = {
    name: "R Tester", email: `${s}@example.com`, password: "RemindPass123!",
    firstName: "R", lastName: "Tester", username: `${tag}_${Date.now() % 1e7}`.toLowerCase(),
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

// Season + gameweek (deadline = NOW() + interval) + one matchday + two matches.
async function seedGameweek(deadlineInterval: string): Promise<{ gameweekId: string; matchIds: string[] }> {
  const seasonId = crypto.randomUUID();
  // isCurrent=false so this seed doesn't collide with other tests' "current
  // season" queries. runDeadlineReminders keys off the deadline window, not
  // isCurrent, so this doesn't affect what we're testing.
  await query(
    `INSERT INTO season (id, name, competition, "startDate", "endDate", "isCurrent", "createdAt", "updatedAt")
     VALUES ($1, '2025-26', 'premier_league', NOW(), NOW() + interval '60 days', false, NOW(), NOW())`,
    [seasonId]
  );
  const gameweekId = crypto.randomUUID();
  await query(
    `INSERT INTO gameweek (id, "seasonId", number, name, deadline, "startsAt", "endsAt", status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'Gameweek 1', NOW() + $4::interval, NOW() + $4::interval, NOW() + $4::interval + interval '2 hours', 'upcoming', NOW(), NOW())`,
    [gameweekId, seasonId, Math.floor(Math.random() * 1000) + 1, deadlineInterval]
  );
  const matchdayId = crypto.randomUUID();
  await query(
    `INSERT INTO matchday (id, "gameweekId", date, "dayNumber", "createdAt", "updatedAt")
     VALUES ($1, $2, '2026-05-01', 1, NOW(), NOW())`,
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

async function makeLeague(): Promise<string> {
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO league (id, name, type, "inviteCode", "createdBy", "createdAt", "updatedAt")
     VALUES ($1, 'Reminders League', 'premier_league', $2, NULL, NOW(), NOW())`,
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

async function submitPredictions(leagueId: string, userId: string, matchIds: string[]): Promise<void> {
  for (const matchId of matchIds) {
    await query(
      `INSERT INTO prediction (id, "userId", "matchId", "leagueId", "homeScore", "awayScore", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 1, 0, NOW(), NOW())`,
      [crypto.randomUUID(), userId, matchId, leagueId]
    );
  }
}

describe("NS2 — deadline reminders", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    await initializeDatabase();
    teamA = await makeTeam(`H${Date.now() % 1000}`);
    teamB = await makeTeam(`A${Date.now() % 1000}`);
  });

  beforeEach(() => {
    pushTestOutbox.length = 0;
  });

  it("notifies only unsubmitted members, once, in the 24h window; dedups on re-run", async () => {
    const { gameweekId, matchIds } = await seedGameweek("23 hours 45 minutes");
    const submitted = await signUpUser("sub24");
    const missing = await signUpUser("miss24");
    const league = await makeLeague();
    await addMember(league, submitted);
    await addMember(league, missing);
    await submitPredictions(league, submitted, matchIds);

    await runDeadlineReminders();

    const forSubmitted = pushTestOutbox.filter((p) => p.userId === submitted);
    const forMissing = pushTestOutbox.filter((p) => p.userId === missing);
    expect(forSubmitted.length).toBe(0);
    expect(forMissing.length).toBe(1);
    expect(forMissing[0]!.kind).toBe("deadline_24h");

    // Re-run: dedup means no new sends for this gameweek.
    pushTestOutbox.length = 0;
    await runDeadlineReminders();
    expect(pushTestOutbox.filter((p) => p.userId === missing).length).toBe(0);

    // sanity: exactly one push_log row for the missing member + this gameweek
    const logCount = await queryOne<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM push_log WHERE user_id = $1 AND subject_id = $2`,
      [missing, gameweekId]
    );
    expect(logCount?.n).toBe("1");
  });

  it("fires deadline_1h in the 1h window", async () => {
    const { matchIds } = await seedGameweek("45 minutes");
    const missing = await signUpUser("miss1h");
    const league = await makeLeague();
    await addMember(league, missing);
    // no predictions submitted
    void matchIds;

    await runDeadlineReminders();

    const forMissing = pushTestOutbox.filter((p) => p.userId === missing);
    // Could receive both deadline_1h (this gw) — assert the 1h one is present.
    expect(forMissing.some((p) => p.kind === "deadline_1h")).toBe(true);
  });
});
