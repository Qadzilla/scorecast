import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { db } from "../db.js";

describe("User API", () => {
  let userCookie: string;
  let testUserId: string;
  let testTeamId: string;

  const testUser = {
    name: "User API Test User",
    email: `user-api-${Date.now()}@example.com`,
    password: "TestPassword123!",
    username: `userapi_${Date.now()}`,
    firstName: "User",
    lastName: "API",
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

    // Get a team ID for testing
    const team = db.prepare("SELECT id FROM team LIMIT 1").get() as { id: string } | undefined;
    if (team) {
      testTeamId = team.id;
    }
  });

  afterAll(() => {
    try {
      db.prepare("DELETE FROM user WHERE email = ?").run(testUser.email);
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe("GET /api/user/teams", () => {
    it("should return list of teams", async () => {
      const response = await request(app)
        .get("/api/user/teams")
        .set("Cookie", userCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty("id");
        expect(response.body[0]).toHaveProperty("name");
        expect(response.body[0]).toHaveProperty("logo");
      }
    });

    it("should require authentication", async () => {
      const response = await request(app).get("/api/user/teams");
      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/user/favorite-team", () => {
    it("should return null when no favorite team set", async () => {
      const response = await request(app)
        .get("/api/user/favorite-team")
        .set("Cookie", userCookie);

      expect(response.status).toBe(200);
      expect(response.body.favoriteTeamId).toBeNull();
    });

    it("should require authentication", async () => {
      const response = await request(app).get("/api/user/favorite-team");
      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/user/favorite-team", () => {
    it("should set favorite team", async () => {
      if (!testTeamId) return;

      const response = await request(app)
        .post("/api/user/favorite-team")
        .send({ teamId: testTeamId })
        .set("Cookie", userCookie)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.team).toBeDefined();
    });

    it("should return favorite team after setting", async () => {
      if (!testTeamId) return;

      const response = await request(app)
        .get("/api/user/favorite-team")
        .set("Cookie", userCookie);

      expect(response.status).toBe(200);
      expect(response.body.favoriteTeamId).toBe(testTeamId);
      expect(response.body.team).toBeDefined();
    });

    it("should reject invalid team ID", async () => {
      const response = await request(app)
        .post("/api/user/favorite-team")
        .send({ teamId: "non-existent-team-id" })
        .set("Cookie", userCookie)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(404);
    });

    it("should reject missing team ID", async () => {
      const response = await request(app)
        .post("/api/user/favorite-team")
        .send({})
        .set("Cookie", userCookie)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(400);
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .post("/api/user/favorite-team")
        .send({ teamId: testTeamId })
        .set("Content-Type", "application/json");

      expect(response.status).toBe(401);
    });
  });

  describe("PUT /api/user/username", () => {
    it("should update username", async () => {
      // Use shorter username to stay within 20 char limit
      const newUsername = `upd_${Date.now().toString().slice(-10)}`;

      const response = await request(app)
        .put("/api/user/username")
        .send({ username: newUsername })
        .set("Cookie", userCookie)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.username).toBe(newUsername.toLowerCase());
    });

    it("should reject username too short", async () => {
      const response = await request(app)
        .put("/api/user/username")
        .send({ username: "ab" })
        .set("Cookie", userCookie)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("3 and 20");
    });

    it("should reject username too long", async () => {
      const response = await request(app)
        .put("/api/user/username")
        .send({ username: "a".repeat(21) })
        .set("Cookie", userCookie)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("3 and 20");
    });

    it("should reject invalid characters in username", async () => {
      const response = await request(app)
        .put("/api/user/username")
        .send({ username: "user@name!" })
        .set("Cookie", userCookie)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("letters, numbers, and underscores");
    });

    it("should reject duplicate username", async () => {
      // Create another user first (username must be <=20 chars)
      const otherUser = {
        name: "Other User",
        email: `other-${Date.now()}@example.com`,
        password: "TestPassword123!",
        username: `taken_${Date.now().toString().slice(-10)}`,
        firstName: "Other",
        lastName: "User",
      };

      await request(app)
        .post("/api/auth/sign-up/email")
        .send(otherUser)
        .set("Content-Type", "application/json");

      db.prepare("UPDATE user SET emailVerified = 1 WHERE email = ?").run(otherUser.email);

      // Try to take that username
      const response = await request(app)
        .put("/api/user/username")
        .send({ username: otherUser.username })
        .set("Cookie", userCookie)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(409);
      expect(response.body.error).toContain("already taken");

      // Cleanup - delete related records first due to foreign keys
      const otherUserId = db.prepare("SELECT id FROM user WHERE email = ?").get(otherUser.email) as { id: string } | undefined;
      if (otherUserId) {
        db.prepare("DELETE FROM session WHERE userId = ?").run(otherUserId.id);
        db.prepare("DELETE FROM account WHERE userId = ?").run(otherUserId.id);
        db.prepare("DELETE FROM user WHERE id = ?").run(otherUserId.id);
      }
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .put("/api/user/username")
        .send({ username: "newusername" })
        .set("Content-Type", "application/json");

      expect(response.status).toBe(401);
    });
  });
});
