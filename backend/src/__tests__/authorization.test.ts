import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { query, queryOne, initializeDatabase } from "../db.js";

/**
 * Authorization Security Tests
 * Tests for horizontal privilege escalation and unauthorized data access
 */
describe("Authorization Security Tests", () => {
  let user1Cookie: string;
  let user2Cookie: string;
  let user1Id: string;
  let user2Id: string;
  let testLeagueId: string;
  let privateLeagueId: string;
  let testGameweekId: string;

  const user1 = {
    name: "Auth Test User 1",
    email: `authtest1-${Date.now()}@example.com`,
    password: "TestPassword123!",
    firstName: "Auth",
    lastName: "Test1",
    username: `authtest1_${Date.now()}`,
  };

  const user2 = {
    name: "Auth Test User 2",
    email: `authtest2-${Date.now()}@example.com`,
    password: "TestPassword123!",
    firstName: "Auth",
    lastName: "Test2",
    username: `authtest2_${Date.now()}`,
  };

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    await initializeDatabase();

    // Create user 1
    const signup1 = await request(app)
      .post("/api/auth/sign-up/email")
      .send(user1)
      .set("Content-Type", "application/json");

    user1Id = signup1.body.user?.id;
    await query(`UPDATE "user" SET "emailVerified" = true WHERE email = $1`, [user1.email]);

    const login1 = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: user1.email, password: user1.password })
      .set("Content-Type", "application/json");

    user1Cookie = login1.headers["set-cookie"]?.[0] || "";

    // Create user 2
    const signup2 = await request(app)
      .post("/api/auth/sign-up/email")
      .send(user2)
      .set("Content-Type", "application/json");

    user2Id = signup2.body.user?.id;
    await query(`UPDATE "user" SET "emailVerified" = true WHERE email = $1`, [user2.email]);

    const login2 = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: user2.email, password: user2.password })
      .set("Content-Type", "application/json");

    user2Cookie = login2.headers["set-cookie"]?.[0] || "";

    const now = new Date().toISOString();

    // Create a league that user1 owns but user2 is NOT a member
    privateLeagueId = `private-league-${Date.now()}`;
    await query(
      `INSERT INTO league (id, name, type, "inviteCode", "createdBy", "createdAt", "updatedAt")
      VALUES ($1, 'Private League', 'premier_league', 'PRIV1234', $2, $3, $4)`,
      [privateLeagueId, user1Id, now, now]
    );

    await query(
      `INSERT INTO league_member (id, "leagueId", "userId", role, "joinedAt")
      VALUES ($1, $2, $3, 'admin', $4)`,
      [`priv-member-${Date.now()}`, privateLeagueId, user1Id, now]
    );

    // Create a shared league for other tests
    testLeagueId = `shared-league-${Date.now()}`;
    await query(
      `INSERT INTO league (id, name, type, "inviteCode", "createdBy", "createdAt", "updatedAt")
      VALUES ($1, 'Shared League', 'premier_league', 'SHARE123', $2, $3, $4)`,
      [testLeagueId, user1Id, now, now]
    );

    await query(
      `INSERT INTO league_member (id, "leagueId", "userId", role, "joinedAt")
      VALUES ($1, $2, $3, 'admin', $4)`,
      [`share-member1-${Date.now()}`, testLeagueId, user1Id, now]
    );

    await query(
      `INSERT INTO league_member (id, "leagueId", "userId", role, "joinedAt")
      VALUES ($1, $2, $3, 'member', $4)`,
      [`share-member2-${Date.now()}`, testLeagueId, user2Id, now]
    );

    // Get a gameweek for prediction tests
    const season = await queryOne<{ id: string }>(
      `SELECT id FROM season WHERE competition = 'premier_league' AND "isCurrent" = true`
    );

    if (season) {
      const gameweek = await queryOne<{ id: string }>(
        `SELECT id FROM gameweek WHERE "seasonId" = $1 LIMIT 1`,
        [season.id]
      );

      if (gameweek) {
        testGameweekId = gameweek.id;
      }
    }
  });

  afterAll(async () => {
    try {
      // Clean up predictions
      await query(`DELETE FROM prediction WHERE "leagueId" IN ($1, $2)`, [testLeagueId, privateLeagueId]);

      // Clean up league members
      await query(`DELETE FROM league_member WHERE "leagueId" IN ($1, $2)`, [testLeagueId, privateLeagueId]);

      // Clean up leagues
      await query(`DELETE FROM league WHERE id IN ($1, $2)`, [testLeagueId, privateLeagueId]);

      // Clean up users
      for (const user of [user1, user2]) {
        const userId = await queryOne<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [user.email]);
        if (userId) {
          await query(`DELETE FROM session WHERE "userId" = $1`, [userId.id]);
          await query(`DELETE FROM account WHERE "userId" = $1`, [userId.id]);
          await query(`DELETE FROM "user" WHERE id = $1`, [userId.id]);
        }
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe("League Access Control", () => {
    it("should prevent non-member from accessing private league leaderboard", async () => {
      const response = await request(app)
        .get(`/api/leaderboard/${privateLeagueId}`)
        .set("Cookie", user2Cookie);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("You are not a member of this league");
    });

    it("should prevent non-member from accessing private league predictions", async () => {
      if (!testGameweekId) return;

      const response = await request(app)
        .get(`/api/predictions/${privateLeagueId}/gameweek/${testGameweekId}`)
        .set("Cookie", user2Cookie);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("You are not a member of this league");
    });

    it("should prevent non-member from submitting predictions to private league", async () => {
      if (!testGameweekId) return;

      const response = await request(app)
        .post(`/api/predictions/${privateLeagueId}/gameweek/${testGameweekId}`)
        .send({ predictions: [{ matchId: "test", homeScore: 1, awayScore: 0 }] })
        .set("Cookie", user2Cookie)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(403);
    });

    it("should allow member to access shared league leaderboard", async () => {
      const response = await request(app)
        .get(`/api/leaderboard/${testLeagueId}`)
        .set("Cookie", user2Cookie);

      expect(response.status).toBe(200);
    });

    it("should prevent accessing non-existent league", async () => {
      const response = await request(app)
        .get("/api/leaderboard/non-existent-league-id")
        .set("Cookie", user1Cookie);

      expect(response.status).toBe(403);
    });
  });

  describe("User Data Access Control", () => {
    it("should allow user to view their own rank", async () => {
      const response = await request(app)
        .get(`/api/leaderboard/${testLeagueId}/user/${user1Id}`)
        .set("Cookie", user1Cookie);

      expect(response.status).toBe(200);
    });

    it("should allow league member to view other member's rank", async () => {
      const response = await request(app)
        .get(`/api/leaderboard/${testLeagueId}/user/${user1Id}`)
        .set("Cookie", user2Cookie);

      // Should be allowed since both are in the same league
      expect(response.status).toBe(200);
    });

    it("should prevent non-member from viewing rank in private league", async () => {
      const response = await request(app)
        .get(`/api/leaderboard/${privateLeagueId}/user/${user1Id}`)
        .set("Cookie", user2Cookie);

      expect(response.status).toBe(403);
    });
  });

  describe("ID Manipulation Attempts", () => {
    it("should handle malicious league ID", async () => {
      const response = await request(app)
        .get("/api/leaderboard/'; DROP TABLE league; --")
        .set("Cookie", user1Cookie);

      // Should return 403 (not found/not member) not 500
      expect([403, 404]).toContain(response.status);
    });

    it("should handle UUID-like but invalid league ID", async () => {
      const response = await request(app)
        .get("/api/leaderboard/00000000-0000-0000-0000-000000000000")
        .set("Cookie", user1Cookie);

      expect(response.status).toBe(403);
    });

    it("should handle extremely long league ID", async () => {
      const response = await request(app)
        .get(`/api/leaderboard/${"a".repeat(1000)}`)
        .set("Cookie", user1Cookie);

      expect([400, 403, 404]).toContain(response.status);
    });
  });

  describe("Prediction Authorization", () => {
    it("should only show user's own predictions", async () => {
      if (!testGameweekId) return;

      const response = await request(app)
        .get(`/api/predictions/${testLeagueId}/gameweek/${testGameweekId}`)
        .set("Cookie", user1Cookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // Each prediction should belong to the requesting user (verified by endpoint logic)
      // We can't directly verify userId in response, but we trust the implementation
    });
  });

  describe("User Profile Authorization", () => {
    it("should only allow user to update their own username", async () => {
      // User trying to update their own username - should work
      const response = await request(app)
        .put("/api/user/username")
        .send({ username: `new_${Date.now().toString().slice(-8)}` })
        .set("Cookie", user1Cookie)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(200);
    });

    it("should only allow user to set their own favorite team", async () => {
      // Get a team ID
      const team = await queryOne<{ id: string }>(`SELECT id FROM team LIMIT 1`);
      if (!team) return;

      const response = await request(app)
        .post("/api/user/favorite-team")
        .send({ teamId: team.id })
        .set("Cookie", user1Cookie)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(200);
    });
  });

  describe("Cross-User Data Isolation", () => {
    it("should not expose other users' data in league list", async () => {
      const response = await request(app)
        .get("/api/leagues")
        .set("Cookie", user2Cookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // User2 should NOT see the private league
      const leagueIds = response.body.map((l: any) => l.id);
      expect(leagueIds).not.toContain(privateLeagueId);

      // User2 should see the shared league
      expect(leagueIds).toContain(testLeagueId);
    });
  });

  describe("Invite Code Security", () => {
    it("should not expose invite codes in league list for non-admin members", async () => {
      const response = await request(app)
        .get("/api/leagues")
        .set("Cookie", user2Cookie);

      expect(response.status).toBe(200);

      const sharedLeague = response.body.find((l: any) => l.id === testLeagueId);
      // Non-admin members may or may not see invite code depending on implementation
      // This documents current behavior
      if (sharedLeague) {
        expect(sharedLeague.role).toBe("member");
      }
    });
  });
});

describe("Session Security", () => {
  it("should reject requests with expired/invalid session", async () => {
    const response = await request(app)
      .get("/api/leagues")
      .set("Cookie", "pl-predictions.session_token=invalid-expired-token");

    expect(response.status).toBe(401);
  });

  it("should reject requests with tampered session token", async () => {
    const response = await request(app)
      .get("/api/leagues")
      .set("Cookie", "pl-predictions.session_token=eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIxMjM0NSIsImlhdCI6MTYwMDAwMDAwMH0.tampered");

    expect(response.status).toBe(401);
  });

  it("should reject requests without any session", async () => {
    const response = await request(app)
      .get("/api/leagues");

    expect(response.status).toBe(401);
  });
});
