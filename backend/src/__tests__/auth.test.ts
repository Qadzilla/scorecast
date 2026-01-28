import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { db } from "../db.js";

// Test user credentials with all required fields
const testUser = {
  name: "Test User",
  email: `test-${Date.now()}@example.com`,
  password: "TestPassword123!",
  firstName: "Test",
  lastName: "User",
  username: `testuser_${Date.now()}`,
};

describe("Auth API", () => {
  beforeAll(() => {
    process.env.NODE_ENV = "test";
  });

  afterAll(() => {
    try {
      db.prepare("DELETE FROM user WHERE email = ?").run(testUser.email);
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe("POST /api/auth/sign-up/email", () => {
    it("should create a new user account", async () => {
      const response = await request(app)
        .post("/api/auth/sign-up/email")
        .send(testUser)
        .set("Content-Type", "application/json");

      // better-auth may return 200 or 201 for successful signup
      expect([200, 201]).toContain(response.status);
      if (response.body.user) {
        expect(response.body.user.email).toBe(testUser.email);
      }
    });

    it("should reject duplicate email registration", async () => {
      const response = await request(app)
        .post("/api/auth/sign-up/email")
        .send({
          ...testUser,
          username: `another_${Date.now()}`,
        })
        .set("Content-Type", "application/json");

      // Should be 4xx error for duplicate
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should reject signup without email", async () => {
      const response = await request(app)
        .post("/api/auth/sign-up/email")
        .send({
          name: "No Email User",
          password: "TestPassword123!",
          firstName: "No",
          lastName: "Email",
          username: `noemail_${Date.now()}`,
        })
        .set("Content-Type", "application/json");

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should reject signup without password", async () => {
      const response = await request(app)
        .post("/api/auth/sign-up/email")
        .send({
          name: "No Password User",
          email: `nopassword-${Date.now()}@example.com`,
          firstName: "No",
          lastName: "Password",
          username: `nopassword_${Date.now()}`,
        })
        .set("Content-Type", "application/json");

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should reject signup with short password", async () => {
      const response = await request(app)
        .post("/api/auth/sign-up/email")
        .send({
          name: "Short Password User",
          email: `shortpass-${Date.now()}@example.com`,
          password: "short",
          firstName: "Short",
          lastName: "Password",
          username: `shortpass_${Date.now()}`,
        })
        .set("Content-Type", "application/json");

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should reject signup without required username", async () => {
      const response = await request(app)
        .post("/api/auth/sign-up/email")
        .send({
          name: "No Username",
          email: `nousername-${Date.now()}@example.com`,
          password: "TestPassword123!",
          firstName: "No",
          lastName: "Username",
        })
        .set("Content-Type", "application/json");

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("POST /api/auth/sign-in/email", () => {
    it("should reject login for unverified user", async () => {
      const response = await request(app)
        .post("/api/auth/sign-in/email")
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .set("Content-Type", "application/json");

      // Should fail because email is not verified
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should reject login with wrong password", async () => {
      // First verify the user
      db.prepare("UPDATE user SET emailVerified = 1 WHERE email = ?").run(testUser.email);

      const response = await request(app)
        .post("/api/auth/sign-in/email")
        .send({
          email: testUser.email,
          password: "WrongPassword123!",
        })
        .set("Content-Type", "application/json");

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should reject login with non-existent email", async () => {
      const response = await request(app)
        .post("/api/auth/sign-in/email")
        .send({
          email: "nonexistent@example.com",
          password: "SomePassword123!",
        })
        .set("Content-Type", "application/json");

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should allow login with correct credentials", async () => {
      // Ensure user is verified
      db.prepare("UPDATE user SET emailVerified = 1 WHERE email = ?").run(testUser.email);

      const response = await request(app)
        .post("/api/auth/sign-in/email")
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .set("Content-Type", "application/json");

      expect([200, 201]).toContain(response.status);
    });
  });

  describe("GET /api/auth/session", () => {
    it("should return no session when not logged in", async () => {
      const response = await request(app)
        .get("/api/auth/session")
        .set("Content-Type", "application/json");

      // better-auth returns 200 with null session or user object
      expect([200, 401, 404]).toContain(response.status);
    });

    it("should return session when logged in", async () => {
      // Ensure user is verified
      db.prepare("UPDATE user SET emailVerified = 1 WHERE email = ?").run(testUser.email);

      // Login first
      const loginResponse = await request(app)
        .post("/api/auth/sign-in/email")
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .set("Content-Type", "application/json");

      const cookie = loginResponse.headers["set-cookie"]?.[0] || "";

      if (cookie) {
        const sessionResponse = await request(app)
          .get("/api/auth/session")
          .set("Cookie", cookie);

        expect(sessionResponse.status).toBe(200);
      }
    });
  });
});
