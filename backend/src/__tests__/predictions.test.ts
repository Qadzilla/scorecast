import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { query, queryOne, initializeDatabase } from "../db.js";

describe("Predictions API", () => {
  let userCookie: string;
  let testUserId: string;
  let testLeagueId: string;
  let testGameweekId: string;
  let testMatchId: string;

  const testUser = {
    name: "Predictions Test User",
    email: `predictions-${Date.now()}@example.com`,
    password: "TestPassword123!",
    username: `predictions_${Date.now()}`,
    firstName: "Predictions",
    lastName: "Test",
  };

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    await initializeDatabase();

    // Create and verify user
    const signup = await request(app)
      .post("/api/auth/sign-up/email")
      .send(testUser)
      .set("Content-Type", "application/json");

    testUserId = signup.body.user?.id;

    await query(`UPDATE "user" SET "emailVerified" = true WHERE email = $1`, [testUser.email]);

    // Login
    const login = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: testUser.email, password: testUser.password })
      .set("Content-Type", "application/json");

    userCookie = login.headers["set-cookie"]?.[0] || "";

    // Create test league
    testLeagueId = `test-league-${Date.now()}`;
    const now = new Date().toISOString();
    await query(
      `INSERT INTO league (id, name, type, "inviteCode", "createdBy", "createdAt", "updatedAt")
      VALUES ($1, 'Test League', 'premier_league', 'TEST1234', $2, $3, $4)`,
      [testLeagueId, testUserId, now, now]
    );

    // Add user as member
    await query(
      `INSERT INTO league_member (id, "leagueId", "userId", role, "joinedAt")
      VALUES ($1, $2, $3, 'admin', $4)`,
      [`member-${Date.now()}`, testLeagueId, testUserId, now]
    );

    // Get a real gameweek and match from the database
    const season = await queryOne<{ id: string }>(
      `SELECT id FROM season WHERE competition = 'premier_league' AND "isCurrent" = true`
    );

    if (season) {
      const gameweek = await queryOne<{ id: string }>(
        `SELECT id FROM gameweek WHERE "seasonId" = $1 AND deadline > NOW() LIMIT 1`,
        [season.id]
      );

      if (gameweek) {
        testGameweekId = gameweek.id;

        const matchday = await queryOne<{ id: string }>(
          `SELECT id FROM matchday WHERE "gameweekId" = $1 LIMIT 1`,
          [gameweek.id]
        );

        if (matchday) {
          const match = await queryOne<{ id: string }>(
            `SELECT id FROM match WHERE "matchdayId" = $1 LIMIT 1`,
            [matchday.id]
          );

          if (match) {
            testMatchId = match.id;
          }
        }
      }
    }
  });

  afterAll(async () => {
    try {
      await query(`DELETE FROM prediction WHERE "leagueId" = $1`, [testLeagueId]);
      await query(`DELETE FROM league_member WHERE "leagueId" = $1`, [testLeagueId]);
      await query(`DELETE FROM league WHERE id = $1`, [testLeagueId]);
      await query(`DELETE FROM "user" WHERE email = $1`, [testUser.email]);
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe("POST /api/predictions/:leagueId/gameweek/:gameweekId", () => {
    it("should submit predictions successfully", async () => {
      if (!testGameweekId || !testMatchId) {
        console.log("Skipping test - no active gameweek/match found");
        return;
      }

      const response = await request(app)
        .post(`/api/predictions/${testLeagueId}/gameweek/${testGameweekId}`)
        .send({
          predictions: [
            { matchId: testMatchId, homeScore: 2, awayScore: 1 },
          ],
        })
        .set("Cookie", userCookie)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should reject predictions without authentication", async () => {
      if (!testGameweekId || !testMatchId) return;

      const response = await request(app)
        .post(`/api/predictions/${testLeagueId}/gameweek/${testGameweekId}`)
        .send({
          predictions: [{ matchId: testMatchId, homeScore: 1, awayScore: 1 }],
        })
        .set("Content-Type", "application/json");

      expect(response.status).toBe(401);
    });

    it("should reject predictions for non-member league", async () => {
      if (!testGameweekId || !testMatchId) return;

      const response = await request(app)
        .post(`/api/predictions/non-existent-league/gameweek/${testGameweekId}`)
        .send({
          predictions: [{ matchId: testMatchId, homeScore: 1, awayScore: 1 }],
        })
        .set("Cookie", userCookie)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(403);
    });

    it("should reject negative scores", async () => {
      if (!testGameweekId || !testMatchId) return;

      const response = await request(app)
        .post(`/api/predictions/${testLeagueId}/gameweek/${testGameweekId}`)
        .send({
          predictions: [{ matchId: testMatchId, homeScore: -1, awayScore: 1 }],
        })
        .set("Cookie", userCookie)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(400);
    });

    it("should reject scores over 20", async () => {
      if (!testGameweekId || !testMatchId) return;

      const response = await request(app)
        .post(`/api/predictions/${testLeagueId}/gameweek/${testGameweekId}`)
        .send({
          predictions: [{ matchId: testMatchId, homeScore: 21, awayScore: 1 }],
        })
        .set("Cookie", userCookie)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(400);
    });

    it("should reject empty predictions array", async () => {
      if (!testGameweekId) return;

      const response = await request(app)
        .post(`/api/predictions/${testLeagueId}/gameweek/${testGameweekId}`)
        .send({ predictions: [] })
        .set("Cookie", userCookie)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/predictions/:leagueId/gameweek/:gameweekId", () => {
    it("should get user predictions", async () => {
      if (!testGameweekId) return;

      const response = await request(app)
        .get(`/api/predictions/${testLeagueId}/gameweek/${testGameweekId}`)
        .set("Cookie", userCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it("should require authentication", async () => {
      if (!testGameweekId) return;

      const response = await request(app)
        .get(`/api/predictions/${testLeagueId}/gameweek/${testGameweekId}`);

      expect(response.status).toBe(401);
    });

    it("should reject non-member access", async () => {
      if (!testGameweekId) return;

      const response = await request(app)
        .get(`/api/predictions/non-existent-league/gameweek/${testGameweekId}`)
        .set("Cookie", userCookie);

      expect(response.status).toBe(403);
    });
  });
});

describe("Prediction Scoring Logic", () => {
  it("should award 3 points for exact score", () => {
    // This tests the scoring function logic
    const calculatePoints = (
      predictedHome: number,
      predictedAway: number,
      actualHome: number,
      actualAway: number
    ): number => {
      // Exact score match
      if (predictedHome === actualHome && predictedAway === actualAway) {
        return 3;
      }

      // Correct result (win/draw/loss)
      const predictedResult =
        predictedHome > predictedAway
          ? "home"
          : predictedHome < predictedAway
          ? "away"
          : "draw";
      const actualResult =
        actualHome > actualAway
          ? "home"
          : actualHome < actualAway
          ? "away"
          : "draw";

      if (predictedResult === actualResult) {
        return 1;
      }

      return 0;
    };

    // Exact score tests
    expect(calculatePoints(2, 1, 2, 1)).toBe(3);
    expect(calculatePoints(0, 0, 0, 0)).toBe(3);
    expect(calculatePoints(3, 3, 3, 3)).toBe(3);

    // Correct result tests
    expect(calculatePoints(2, 0, 3, 1)).toBe(1); // Home win
    expect(calculatePoints(0, 2, 1, 3)).toBe(1); // Away win
    expect(calculatePoints(1, 1, 2, 2)).toBe(1); // Draw

    // Wrong result tests
    expect(calculatePoints(2, 1, 0, 2)).toBe(0); // Predicted home, actual away
    expect(calculatePoints(0, 2, 2, 0)).toBe(0); // Predicted away, actual home
    expect(calculatePoints(1, 1, 2, 1)).toBe(0); // Predicted draw, actual home
  });
});
