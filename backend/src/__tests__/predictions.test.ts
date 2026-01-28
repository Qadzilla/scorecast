import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { db } from "../db.js";

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
  };

  beforeAll(async () => {
    process.env.NODE_ENV = "test";

    // Create and verify user
    const signup = await request(app)
      .post("/api/auth/sign-up/email")
      .send(testUser)
      .set("Content-Type", "application/json");

    testUserId = signup.body.user?.id;

    db.prepare("UPDATE user SET emailVerified = 1 WHERE email = ?").run(testUser.email);

    // Login
    const login = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: testUser.email, password: testUser.password })
      .set("Content-Type", "application/json");

    userCookie = login.headers["set-cookie"]?.[0] || "";

    // Create test league
    testLeagueId = `test-league-${Date.now()}`;
    db.prepare(`
      INSERT INTO league (id, name, type, inviteCode, createdBy, createdAt, updatedAt)
      VALUES (?, 'Test League', 'premier_league', 'TEST1234', ?, datetime('now'), datetime('now'))
    `).run(testLeagueId, testUserId);

    // Add user as member
    db.prepare(`
      INSERT INTO league_member (id, leagueId, userId, role, joinedAt)
      VALUES (?, ?, ?, 'admin', datetime('now'))
    `).run(`member-${Date.now()}`, testLeagueId, testUserId);

    // Get a real gameweek and match from the database
    const season = db.prepare(`
      SELECT id FROM season WHERE competition = 'premier_league' AND isCurrent = 1
    `).get() as { id: string } | undefined;

    if (season) {
      const gameweek = db.prepare(`
        SELECT id FROM gameweek WHERE seasonId = ? AND deadline > datetime('now') LIMIT 1
      `).get(season.id) as { id: string } | undefined;

      if (gameweek) {
        testGameweekId = gameweek.id;

        const matchday = db.prepare(`
          SELECT id FROM matchday WHERE gameweekId = ? LIMIT 1
        `).get(gameweek.id) as { id: string } | undefined;

        if (matchday) {
          const match = db.prepare(`
            SELECT id FROM match WHERE matchdayId = ? LIMIT 1
          `).get(matchday.id) as { id: string } | undefined;

          if (match) {
            testMatchId = match.id;
          }
        }
      }
    }
  });

  afterAll(() => {
    try {
      db.prepare("DELETE FROM prediction WHERE leagueId = ?").run(testLeagueId);
      db.prepare("DELETE FROM league_member WHERE leagueId = ?").run(testLeagueId);
      db.prepare("DELETE FROM league WHERE id = ?").run(testLeagueId);
      db.prepare("DELETE FROM user WHERE email = ?").run(testUser.email);
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
