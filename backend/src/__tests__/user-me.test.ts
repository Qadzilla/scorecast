import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { query, initializeDatabase } from "../db.js";

// MS4 — GET /api/user/me + admin consolidation (MOBILE_PLAN.md §4.4).
// The mobile app reads isAdmin from here instead of a client-baked env var,
// and both the leagues and admin routes now share one admin check.

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "test-admin@example.com";

async function signUpVerified(user: Record<string, string>): Promise<string> {
  const res = await request(app).post("/api/auth/sign-up/email").send(user);
  expect(res.status).toBe(200);
  // Bypass email verification directly so we can sign in
  await query(`UPDATE "user" SET "emailVerified" = true WHERE email = $1`, [
    user.email,
  ]);
  const signIn = await request(app)
    .post("/api/auth/sign-in/email")
    .send({ email: user.email, password: user.password });
  expect(signIn.status).toBe(200);
  const cookie = signIn.headers["set-cookie"];
  expect(cookie).toBeDefined();
  return (Array.isArray(cookie) ? cookie : [cookie]).join("; ");
}

describe("GET /api/user/me", () => {
  const stamp = Date.now();
  const adminUser = {
    name: "Admin Me",
    email: ADMIN_EMAIL,
    password: "AdminPassword123!",
    firstName: "Admin",
    lastName: "Me",
    username: `admin_me_${stamp}`,
  };
  const regularUser = {
    name: "Regular Me",
    email: `regular-me-${stamp}@example.com`,
    password: "RegularPassword123!",
    firstName: "Regular",
    lastName: "Me",
    username: `regular_me_${stamp}`,
  };

  let adminCookie: string;
  let regularCookie: string;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.ADMIN_EMAILS = ADMIN_EMAIL;
    await initializeDatabase();
    adminCookie = await signUpVerified(adminUser);
    regularCookie = await signUpVerified(regularUser);
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/user/me");
    expect(res.status).toBe(401);
  });

  it("returns the profile with isAdmin=false for a regular user", async () => {
    const res = await request(app).get("/api/user/me").set("Cookie", regularCookie);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(regularUser.email);
    expect(res.body.username).toBe(regularUser.username);
    expect(res.body.firstName).toBe("Regular");
    expect(res.body.isAdmin).toBe(false);
    // Never leak credential material
    expect(res.body.password).toBeUndefined();
  });

  it("returns isAdmin=true for the admin user", async () => {
    const res = await request(app).get("/api/user/me").set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.isAdmin).toBe(true);
  });
});

describe("admin consolidation", () => {
  it("isAdmin helper honors both ADMIN_EMAILS and legacy ADMIN_EMAIL, case-insensitively", async () => {
    const { isAdmin } = await import("../lib/admin.js");
    const savedEmails = process.env.ADMIN_EMAILS;
    const savedEmail = process.env.ADMIN_EMAIL;
    try {
      process.env.ADMIN_EMAILS = "boss@example.com, chief@example.com";
      process.env.ADMIN_EMAIL = "legacy@example.com";
      expect(isAdmin("boss@example.com")).toBe(true);
      expect(isAdmin("CHIEF@EXAMPLE.COM")).toBe(true); // case-insensitive
      expect(isAdmin("legacy@example.com")).toBe(true); // deprecation fallback
      expect(isAdmin("nobody@example.com")).toBe(false);
      expect(isAdmin(null)).toBe(false);
      expect(isAdmin(undefined)).toBe(false);
    } finally {
      process.env.ADMIN_EMAILS = savedEmails;
      process.env.ADMIN_EMAIL = savedEmail;
    }
  });
});
