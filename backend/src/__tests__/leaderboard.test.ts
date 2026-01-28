import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { db } from "../db.js";

describe("Leaderboard API", () => {
  let userCookie: string;
  let user2Cookie: string;
  let testUserId: string;
  let testUser2Id: string;
  let testLeagueId: string;

  const testUser = {
    name: "Leaderboard Test User",
    email: `leaderboard-${Date.now()}@example.com`,
    password: "TestPassword123!",
    username: `leaderboard_${Date.now()}`,
    firstName: "Leaderboard",
    lastName: "Test",
  };

  const testUser2 = {
    name: "Leaderboard Test User 2",
    email: `leaderboard2-${Date.now()}@example.com`,
    password: "TestPassword123!",
    username: `leaderboard2_${Date.now()}`,
    firstName: "Leaderboard",
    lastName: "Test2",
  };

  beforeAll(async () => {
    process.env.NODE_ENV = "test";

    // Create and verify user 1
    const signup = await request(app)
      .post("/api/auth/sign-up/email")
      .send(testUser)
      .set("Content-Type", "application/json");
    testUserId = signup.body.user?.id;
    db.prepare("UPDATE user SET emailVerified = 1 WHERE email = ?").run(testUser.email);

    const login = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: testUser.email, password: testUser.password })
      .set("Content-Type", "application/json");
    userCookie = login.headers["set-cookie"]?.[0] || "";

    // Create and verify user 2
    const signup2 = await request(app)
      .post("/api/auth/sign-up/email")
      .send(testUser2)
      .set("Content-Type", "application/json");
    testUser2Id = signup2.body.user?.id;
    db.prepare("UPDATE user SET emailVerified = 1 WHERE email = ?").run(testUser2.email);

    const login2 = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: testUser2.email, password: testUser2.password })
      .set("Content-Type", "application/json");
    user2Cookie = login2.headers["set-cookie"]?.[0] || "";

    // Create test league
    testLeagueId = `leaderboard-league-${Date.now()}`;
    db.prepare(`
      INSERT INTO league (id, name, type, inviteCode, createdBy, createdAt, updatedAt)
      VALUES (?, 'Leaderboard Test League', 'premier_league', 'LBTEST12', ?, datetime('now'), datetime('now'))
    `).run(testLeagueId, testUserId);

    // Add users as members
    db.prepare(`
      INSERT INTO league_member (id, leagueId, userId, role, joinedAt)
      VALUES (?, ?, ?, 'admin', datetime('now'))
    `).run(`member1-${Date.now()}`, testLeagueId, testUserId);

    db.prepare(`
      INSERT INTO league_member (id, leagueId, userId, role, joinedAt)
      VALUES (?, ?, ?, 'member', datetime('now'))
    `).run(`member2-${Date.now()}`, testLeagueId, testUser2Id);
  });

  afterAll(() => {
    try {
      db.prepare("DELETE FROM prediction WHERE leagueId = ?").run(testLeagueId);
      db.prepare("DELETE FROM league_member WHERE leagueId = ?").run(testLeagueId);
      db.prepare("DELETE FROM league WHERE id = ?").run(testLeagueId);
      db.prepare("DELETE FROM user WHERE email IN (?, ?)").run(testUser.email, testUser2.email);
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe("GET /api/leaderboard/:leagueId", () => {
    it("should return leaderboard for league members", async () => {
      const response = await request(app)
        .get(`/api/leaderboard/${testLeagueId}`)
        .set("Cookie", userCookie);

      expect(response.status).toBe(200);
      expect(response.body.entries).toBeDefined();
      expect(Array.isArray(response.body.entries)).toBe(true);
      expect(response.body.isSeasonComplete).toBeDefined();
      expect(response.body.champion).toBeDefined();
    });

    it("should include all league members in standings", async () => {
      const response = await request(app)
        .get(`/api/leaderboard/${testLeagueId}`)
        .set("Cookie", userCookie);

      expect(response.body.entries.length).toBe(2);

      const userIds = response.body.entries.map((e: any) => e.userId);
      expect(userIds).toContain(testUserId);
      expect(userIds).toContain(testUser2Id);
    });

    it("should order by total points descending", async () => {
      const response = await request(app)
        .get(`/api/leaderboard/${testLeagueId}`)
        .set("Cookie", userCookie);

      const entries = response.body.entries;
      for (let i = 1; i < entries.length; i++) {
        expect(entries[i - 1].totalPoints).toBeGreaterThanOrEqual(entries[i].totalPoints);
      }
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .get(`/api/leaderboard/${testLeagueId}`);

      expect(response.status).toBe(401);
    });

    it("should reject non-member access", async () => {
      // Create another user not in the league
      const outsideUser = {
        name: "Outside User",
        email: `outside-${Date.now()}@example.com`,
        password: "TestPassword123!",
        username: `outside_${Date.now()}`,
        firstName: "Outside",
        lastName: "User",
      };

      await request(app)
        .post("/api/auth/sign-up/email")
        .send(outsideUser)
        .set("Content-Type", "application/json");

      db.prepare("UPDATE user SET emailVerified = 1 WHERE email = ?").run(outsideUser.email);

      const login = await request(app)
        .post("/api/auth/sign-in/email")
        .send({ email: outsideUser.email, password: outsideUser.password })
        .set("Content-Type", "application/json");

      const outsideCookie = login.headers["set-cookie"]?.[0] || "";

      const response = await request(app)
        .get(`/api/leaderboard/${testLeagueId}`)
        .set("Cookie", outsideCookie);

      expect(response.status).toBe(403);

      // Cleanup - delete related records first due to foreign keys
      const outsideUserId = db.prepare("SELECT id FROM user WHERE email = ?").get(outsideUser.email) as { id: string } | undefined;
      if (outsideUserId) {
        db.prepare("DELETE FROM session WHERE userId = ?").run(outsideUserId.id);
        db.prepare("DELETE FROM account WHERE userId = ?").run(outsideUserId.id);
        db.prepare("DELETE FROM user WHERE id = ?").run(outsideUserId.id);
      }
    });

    it("should return 403 for non-existent league", async () => {
      const response = await request(app)
        .get("/api/leaderboard/non-existent-league-id")
        .set("Cookie", userCookie);

      expect(response.status).toBe(403);
    });
  });

  describe("GET /api/leaderboard/:leagueId/user/:userId", () => {
    it("should return user rank details", async () => {
      const response = await request(app)
        .get(`/api/leaderboard/${testLeagueId}/user/${testUserId}`)
        .set("Cookie", userCookie);

      expect(response.status).toBe(200);
      expect(response.body.rank).toBeDefined();
      expect(response.body.totalMembers).toBe(2);
      expect(response.body.totalPoints).toBeDefined();
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .get(`/api/leaderboard/${testLeagueId}/user/${testUserId}`);

      expect(response.status).toBe(401);
    });
  });
});

describe("Season Completion Logic", () => {
  it("should detect when all gameweeks are completed", () => {
    const checkSeasonComplete = (total: number, completed: number): boolean => {
      return total > 0 && total === completed;
    };

    expect(checkSeasonComplete(38, 38)).toBe(true);
    expect(checkSeasonComplete(38, 37)).toBe(false);
    expect(checkSeasonComplete(38, 0)).toBe(false);
    expect(checkSeasonComplete(0, 0)).toBe(false);
  });

  it("should crown champion when season is complete", () => {
    const getChampion = (
      leaderboard: Array<{ rank: number; userId: string; totalPoints: number }>,
      isSeasonComplete: boolean
    ) => {
      if (!isSeasonComplete || leaderboard.length === 0) return null;
      return leaderboard[0];
    };

    const mockLeaderboard = [
      { rank: 1, userId: "user1", totalPoints: 100 },
      { rank: 2, userId: "user2", totalPoints: 90 },
    ];

    expect(getChampion(mockLeaderboard, true)).toEqual(mockLeaderboard[0]);
    expect(getChampion(mockLeaderboard, false)).toBeNull();
    expect(getChampion([], true)).toBeNull();
  });
});
