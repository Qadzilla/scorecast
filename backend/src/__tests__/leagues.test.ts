import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { db } from "../db.js";

// Admin user credentials (set via ADMIN_EMAIL env var in test setup)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "test-admin@example.com";

describe("Leagues API", () => {
  let adminCookie: string;
  let regularCookie: string;
  let testLeagueId: string;
  let testInviteCode: string;

  const adminUser = {
    name: "Admin User",
    email: ADMIN_EMAIL,
    password: "AdminPassword123!",
    firstName: "Admin",
    lastName: "User",
    username: `admin_${Date.now()}`,
  };

  const regularUser = {
    name: "Regular User",
    email: `regular-${Date.now()}@example.com`,
    password: "RegularPassword123!",
    firstName: "Regular",
    lastName: "User",
    username: `regular_${Date.now()}`,
  };

  beforeAll(async () => {
    process.env.NODE_ENV = "test";

    // Create admin user
    const adminSignup = await request(app)
      .post("/api/auth/sign-up/email")
      .send(adminUser)
      .set("Content-Type", "application/json");

    // Manually verify admin email for testing
    db.prepare("UPDATE user SET emailVerified = 1 WHERE email = ?").run(adminUser.email);

    // Login as admin
    const adminLogin = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: adminUser.email, password: adminUser.password })
      .set("Content-Type", "application/json");

    adminCookie = adminLogin.headers["set-cookie"]?.[0] || "";

    // Create regular user
    await request(app)
      .post("/api/auth/sign-up/email")
      .send(regularUser)
      .set("Content-Type", "application/json");

    // Manually verify regular user email
    db.prepare("UPDATE user SET emailVerified = 1 WHERE email = ?").run(regularUser.email);

    // Login as regular user
    const regularLogin = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: regularUser.email, password: regularUser.password })
      .set("Content-Type", "application/json");

    regularCookie = regularLogin.headers["set-cookie"]?.[0] || "";
  });

  afterAll(() => {
    // Cleanup
    try {
      db.prepare("DELETE FROM league_member WHERE leagueId = ?").run(testLeagueId);
      db.prepare("DELETE FROM league WHERE id = ?").run(testLeagueId);
      db.prepare("DELETE FROM user WHERE email IN (?, ?)").run(adminUser.email, regularUser.email);
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe("POST /api/leagues - Create League", () => {
    it("should allow admin to create a league", async () => {
      const response = await request(app)
        .post("/api/leagues")
        .send({
          name: "Test Premier League",
          type: "premier_league",
        })
        .set("Cookie", adminCookie)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(201);
      expect(response.body.name).toBe("Test Premier League");
      expect(response.body.type).toBe("premier_league");
      expect(response.body.inviteCode).toBeDefined();
      expect(response.body.role).toBe("admin");

      testLeagueId = response.body.id;
      testInviteCode = response.body.inviteCode;
    });

    it("should reject league creation from non-admin user", async () => {
      const response = await request(app)
        .post("/api/leagues")
        .send({
          name: "Unauthorized League",
          type: "premier_league",
        })
        .set("Cookie", regularCookie)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Only the admin can create leagues");
    });

    it("should reject league creation without authentication", async () => {
      const response = await request(app)
        .post("/api/leagues")
        .send({
          name: "No Auth League",
          type: "premier_league",
        })
        .set("Content-Type", "application/json");

      expect(response.status).toBe(401);
    });

    it("should reject league creation with invalid type", async () => {
      const response = await request(app)
        .post("/api/leagues")
        .send({
          name: "Invalid Type League",
          type: "invalid_type",
        })
        .set("Cookie", adminCookie)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(400);
    });

    it("should reject league creation without name", async () => {
      const response = await request(app)
        .post("/api/leagues")
        .send({
          type: "premier_league",
        })
        .set("Cookie", adminCookie)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(400);
    });

    it("should reject league name over 100 characters", async () => {
      const response = await request(app)
        .post("/api/leagues")
        .send({
          name: "A".repeat(101),
          type: "premier_league",
        })
        .set("Cookie", adminCookie)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/leagues/join - Join League", () => {
    it("should allow user to join with valid invite code", async () => {
      const response = await request(app)
        .post("/api/leagues/join")
        .send({ inviteCode: testInviteCode })
        .set("Cookie", regularCookie)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(200);
      expect(response.body.role).toBe("member");
    });

    it("should reject joining same league twice", async () => {
      const response = await request(app)
        .post("/api/leagues/join")
        .send({ inviteCode: testInviteCode })
        .set("Cookie", regularCookie)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("You are already a member of this league");
    });

    it("should reject invalid invite code", async () => {
      const response = await request(app)
        .post("/api/leagues/join")
        .send({ inviteCode: "INVALID1" })
        .set("Cookie", regularCookie)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(404);
    });

    it("should reject join without authentication", async () => {
      const response = await request(app)
        .post("/api/leagues/join")
        .send({ inviteCode: testInviteCode })
        .set("Content-Type", "application/json");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/leagues - Get User Leagues", () => {
    it("should return user's leagues", async () => {
      const response = await request(app)
        .get("/api/leagues")
        .set("Cookie", adminCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      const league = response.body.find((l: any) => l.id === testLeagueId);
      expect(league).toBeDefined();
      expect(league.role).toBe("admin");
    });

    it("should require authentication", async () => {
      const response = await request(app).get("/api/leagues");

      expect(response.status).toBe(401);
    });
  });
});
