import { describe, it, expect } from "vitest";
import request from "supertest";

// Rate limits are read at app import time, so configure the environment
// before dynamically importing the app. Other test files get the default
// (skipped) limiter behavior because vitest isolates module graphs per file.
process.env.TEST_ENABLE_RATE_LIMIT = "true";
process.env.RATE_LIMIT_GENERAL_MAX = "10";
process.env.RATE_LIMIT_AUTH_MAX = "3";

const { app } = await import("../app.js");

// NOTE: the tests below share limiter state (in-memory, keyed by IP) and are
// order-dependent within this file — vitest runs them sequentially.

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("rate limiting", () => {
  it("auth limiter caps /api/auth/* and returns a JSON error", async () => {
    // Email-shaped identifier short-circuits before any DB access
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post("/api/auth/lookup-email")
        .send({ identifier: "someone@example.com" });
      expect(res.status).toBe(200);
    }
    const limited = await request(app)
      .post("/api/auth/lookup-email")
      .send({ identifier: "someone@example.com" });
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({
      error: "Too many auth attempts, please try again later",
    });
  });

  it("general limiter caps remaining routes", async () => {
    // The 4 auth requests above also consumed 4 of the general budget (10).
    // 6 more rate-limited requests exhaust it; the next one must be 429.
    for (let i = 0; i < 6; i++) {
      const res = await request(app).get("/nonexistent-route");
      expect(res.status).toBe(404);
    }
    const limited = await request(app).get("/nonexistent-route");
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({
      error: "Too many requests, please try again later",
    });
  });

  it("health stays exempt after both limiters are exhausted", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
