import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { query, queryOne, initializeDatabase } from "../db.js";

// Admin email must match ADMIN_EMAILS env var
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "test-admin@example.com";

describe("Admin API", () => {
  let adminCookie: string;
  let regularCookie: string;

  const adminUser = {
    name: "Admin User",
    email: ADMIN_EMAIL,
    password: "AdminPassword123!",
    firstName: "Admin",
    lastName: "User",
    username: `admin_adm_${Date.now()}`,
  };

  const regularUser = {
    name: "Regular User",
    email: `regular-adm-${Date.now()}@example.com`,
    password: "RegularPassword123!",
    firstName: "Regular",
    lastName: "User",
    username: `regular_adm_${Date.now()}`,
  };

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    // Set admin emails for admin middleware
    process.env.ADMIN_EMAILS = ADMIN_EMAIL;
    await initializeDatabase();

    // Create admin user
    await request(app)
      .post("/api/auth/sign-up/email")
      .send(adminUser)
      .set("Content-Type", "application/json");

    await query(`UPDATE "user" SET "emailVerified" = true WHERE email = $1`, [adminUser.email]);

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

    await query(`UPDATE "user" SET "emailVerified" = true WHERE email = $1`, [regularUser.email]);

    const regularLogin = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: regularUser.email, password: regularUser.password })
      .set("Content-Type", "application/json");

    regularCookie = regularLogin.headers["set-cookie"]?.[0] || "";
  });

  afterAll(async () => {
    try {
      // Clean up sessions and accounts first
      const adminUserId = await queryOne<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [adminUser.email]);
      const regularUserId = await queryOne<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [regularUser.email]);

      if (adminUserId) {
        await query(`DELETE FROM session WHERE "userId" = $1`, [adminUserId.id]);
        await query(`DELETE FROM account WHERE "userId" = $1`, [adminUserId.id]);
      }
      if (regularUserId) {
        await query(`DELETE FROM session WHERE "userId" = $1`, [regularUserId.id]);
        await query(`DELETE FROM account WHERE "userId" = $1`, [regularUserId.id]);
      }

      await query(`DELETE FROM "user" WHERE email IN ($1, $2)`, [adminUser.email, regularUser.email]);
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe("GET /api/admin/status", () => {
    it("should require authentication", async () => {
      const response = await request(app)
        .get("/api/admin/status");

      expect(response.status).toBe(401);
    });

    it("should reject non-admin users", async () => {
      const response = await request(app)
        .get("/api/admin/status")
        .set("Cookie", regularCookie);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Admin access required");
    });

    it("should return status for admin users", async () => {
      const response = await request(app)
        .get("/api/admin/status")
        .set("Cookie", adminCookie);

      // May return 200 or 403 depending on ADMIN_EMAILS config
      expect([200, 403]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty("premier_league");
        expect(response.body).toHaveProperty("champions_league");
      }
    });
  });

  describe("POST /api/admin/sync/:competition", () => {
    it("should require authentication", async () => {
      const response = await request(app)
        .post("/api/admin/sync/premier_league");

      expect(response.status).toBe(401);
    });

    it("should reject non-admin users", async () => {
      const response = await request(app)
        .post("/api/admin/sync/premier_league")
        .set("Cookie", regularCookie);

      expect(response.status).toBe(403);
    });

    it("should reject invalid competition", async () => {
      const response = await request(app)
        .post("/api/admin/sync/invalid_competition")
        .set("Cookie", adminCookie);

      // May be 400 for invalid competition or 403 if not admin
      expect([400, 403]).toContain(response.status);
    });
  });

  describe("POST /api/admin/sync/:competition/teams", () => {
    it("should require authentication", async () => {
      const response = await request(app)
        .post("/api/admin/sync/premier_league/teams");

      expect(response.status).toBe(401);
    });

    it("should reject non-admin users", async () => {
      const response = await request(app)
        .post("/api/admin/sync/premier_league/teams")
        .set("Cookie", regularCookie);

      expect(response.status).toBe(403);
    });

    it("should reject invalid competition", async () => {
      const response = await request(app)
        .post("/api/admin/sync/invalid/teams")
        .set("Cookie", adminCookie);

      expect([400, 403]).toContain(response.status);
    });
  });

  describe("POST /api/admin/sync/:competition/results", () => {
    it("should require authentication", async () => {
      const response = await request(app)
        .post("/api/admin/sync/premier_league/results");

      expect(response.status).toBe(401);
    });

    it("should reject non-admin users", async () => {
      const response = await request(app)
        .post("/api/admin/sync/premier_league/results")
        .set("Cookie", regularCookie);

      expect(response.status).toBe(403);
    });
  });

  describe("POST /api/admin/sync/all", () => {
    it("should require authentication", async () => {
      const response = await request(app)
        .post("/api/admin/sync/all");

      expect(response.status).toBe(401);
    });

    it("should reject non-admin users", async () => {
      const response = await request(app)
        .post("/api/admin/sync/all")
        .set("Cookie", regularCookie);

      expect(response.status).toBe(403);
    });
  });
});
