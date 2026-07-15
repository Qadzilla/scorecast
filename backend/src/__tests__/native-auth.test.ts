import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { initializeDatabase } from "../db.js";

// MS2 — native auth transport (MOBILE_PLAN.md §4.1).
// The Expo better-auth client presents the app's custom scheme as its origin.
// These tests prove such requests pass BOTH gates: the Express CORS allowlist
// (which would otherwise error -> 500) and better-auth's trustedOrigins CSRF
// check (which would otherwise 403).

const APP_ORIGIN = "scorecast://";

describe("Native app origin (scorecast://)", () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  it("passes the Express CORS layer on API routes", async () => {
    const res = await request(app)
      .post("/api/auth/lookup-email")
      .set("Origin", APP_ORIGIN)
      .send({ identifier: "someone@example.com" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ email: "someone@example.com" });
  });

  it("passes better-auth's trusted-origin check on auth endpoints", async () => {
    // Wrong credentials on purpose: 401 proves the request got through the
    // origin gates and reached credential validation. An untrusted origin
    // would have been rejected with 403 before credentials were checked.
    const res = await request(app)
      .post("/api/auth/sign-in/email")
      .set("Origin", APP_ORIGIN)
      .send({ email: "nobody@example.com", password: "wrong-password-123" });
    expect(res.status).toBe(401);
  });

  it("still rejects unknown origins at the CORS layer", async () => {
    const res = await request(app)
      .post("/api/auth/lookup-email")
      .set("Origin", "https://evil.example.com")
      .send({ identifier: "someone@example.com" });
    expect(res.status).toBe(500); // cors middleware error -> global handler
  });
});
