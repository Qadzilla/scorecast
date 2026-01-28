import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { db } from "../db.js";

describe("Fixtures API", () => {
  let userCookie: string;

  const testUser = {
    name: "Fixtures Test User",
    email: `fixtures-${Date.now()}@example.com`,
    password: "TestPassword123!",
    username: `fixtures_${Date.now()}`,
    firstName: "Fixtures",
    lastName: "Test",
  };

  beforeAll(async () => {
    process.env.NODE_ENV = "test";

    // Create and verify user
    await request(app)
      .post("/api/auth/sign-up/email")
      .send(testUser)
      .set("Content-Type", "application/json");

    db.prepare("UPDATE user SET emailVerified = 1 WHERE email = ?").run(testUser.email);

    // Login
    const login = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: testUser.email, password: testUser.password })
      .set("Content-Type", "application/json");

    userCookie = login.headers["set-cookie"]?.[0] || "";
  });

  afterAll(() => {
    try {
      db.prepare("DELETE FROM user WHERE email = ?").run(testUser.email);
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe("GET /api/fixtures/gameweek/current/:competition", () => {
    it("should return current Premier League gameweek", async () => {
      const response = await request(app)
        .get("/api/fixtures/gameweek/current/premier_league")
        .set("Cookie", userCookie);

      // May return 404 if no active gameweek
      if (response.status === 200) {
        expect(response.body).toHaveProperty("id");
        expect(response.body).toHaveProperty("number");
        expect(response.body).toHaveProperty("deadline");
        expect(response.body).toHaveProperty("status");
      } else {
        expect(response.status).toBe(404);
      }
    });

    it("should return current Champions League gameweek", async () => {
      const response = await request(app)
        .get("/api/fixtures/gameweek/current/champions_league")
        .set("Cookie", userCookie);

      // May return 404 if no active gameweek
      expect([200, 404]).toContain(response.status);
    });

    it("should reject invalid competition type", async () => {
      const response = await request(app)
        .get("/api/fixtures/gameweek/current/invalid_type")
        .set("Cookie", userCookie);

      expect(response.status).toBe(400);
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .get("/api/fixtures/gameweek/current/premier_league");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/fixtures/gameweek/:gameweekId", () => {
    it("should return gameweek with matches", async () => {
      // First get a valid gameweek ID
      const season = db.prepare(
        "SELECT id FROM season WHERE competition = 'premier_league' AND isCurrent = 1"
      ).get() as { id: string } | undefined;

      if (!season) return;

      const gameweek = db.prepare(
        "SELECT id FROM gameweek WHERE seasonId = ? LIMIT 1"
      ).get(season.id) as { id: string } | undefined;

      if (!gameweek) return;

      const response = await request(app)
        .get(`/api/fixtures/gameweek/${gameweek.id}`)
        .set("Cookie", userCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("id");
      expect(response.body).toHaveProperty("matchdays");
      expect(Array.isArray(response.body.matchdays)).toBe(true);
    });

    it("should return 404 for non-existent gameweek", async () => {
      const response = await request(app)
        .get("/api/fixtures/gameweek/non-existent-id")
        .set("Cookie", userCookie);

      expect(response.status).toBe(404);
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .get("/api/fixtures/gameweek/any-id");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/fixtures/season/current/:competition", () => {
    it("should return current Premier League season", async () => {
      const response = await request(app)
        .get("/api/fixtures/season/current/premier_league")
        .set("Cookie", userCookie);

      if (response.status === 200) {
        expect(response.body).toHaveProperty("id");
        expect(response.body).toHaveProperty("name");
        expect(response.body.competition).toBe("premier_league");
      } else {
        expect(response.status).toBe(404);
      }
    });

    it("should reject invalid competition type", async () => {
      const response = await request(app)
        .get("/api/fixtures/season/current/invalid")
        .set("Cookie", userCookie);

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/fixtures/season/:competition/status", () => {
    it("should return season status with completion info", async () => {
      const response = await request(app)
        .get("/api/fixtures/season/premier_league/status")
        .set("Cookie", userCookie);

      if (response.status === 200) {
        expect(response.body).toHaveProperty("id");
        expect(response.body).toHaveProperty("totalGameweeks");
        expect(response.body).toHaveProperty("completedGameweeks");
        expect(response.body).toHaveProperty("isSeasonComplete");
        expect(typeof response.body.isSeasonComplete).toBe("boolean");
      } else {
        expect(response.status).toBe(404);
      }
    });

    it("should reject invalid competition type", async () => {
      const response = await request(app)
        .get("/api/fixtures/season/invalid/status")
        .set("Cookie", userCookie);

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/fixtures/teams/:competition", () => {
    it("should return Premier League teams", async () => {
      const response = await request(app)
        .get("/api/fixtures/teams/premier_league")
        .set("Cookie", userCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty("id");
        expect(response.body[0]).toHaveProperty("name");
        expect(response.body[0].competition).toBe("premier_league");
      }
    });

    it("should return Champions League teams", async () => {
      const response = await request(app)
        .get("/api/fixtures/teams/champions_league")
        .set("Cookie", userCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it("should reject invalid competition type", async () => {
      const response = await request(app)
        .get("/api/fixtures/teams/invalid")
        .set("Cookie", userCookie);

      expect(response.status).toBe(400);
    });
  });
});

describe("Gameweek Status Logic", () => {
  it("should correctly identify gameweek statuses", () => {
    const getExpectedStatus = (deadline: Date, endsAt: Date, now: Date): string => {
      if (now < deadline) return "upcoming";
      if (now > endsAt) return "completed";
      return "active";
    };

    const now = new Date("2024-01-15T12:00:00Z");
    const futureDeadline = new Date("2024-01-20T12:00:00Z");
    const pastDeadline = new Date("2024-01-10T12:00:00Z");
    const pastEnd = new Date("2024-01-12T23:00:00Z");
    const futureEnd = new Date("2024-01-20T23:00:00Z");

    expect(getExpectedStatus(futureDeadline, futureEnd, now)).toBe("upcoming");
    expect(getExpectedStatus(pastDeadline, futureEnd, now)).toBe("active");
    expect(getExpectedStatus(pastDeadline, pastEnd, now)).toBe("completed");
  });
});
