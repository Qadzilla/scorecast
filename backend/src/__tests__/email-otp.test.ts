import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { query, queryOne, initializeDatabase } from "../db.js";
import { testOutbox } from "../email.js";

// MS3 — email verification via 6-digit OTP (MOBILE_PLAN.md §4.2).
// The mobile app requests a code and posts it back; no web redirect.
// The legacy link flow stays enabled in parallel (covered by auth.test.ts).

function makeUser(tag: string) {
  const stamp = `${tag}_${Date.now()}`;
  return {
    name: "Otp Tester",
    email: `otp-${stamp}@example.com`,
    password: "OtpPassword123!",
    firstName: "Otp",
    lastName: "Tester",
    username: `otp_${stamp}`,
  };
}

async function signUp(user: ReturnType<typeof makeUser>) {
  const res = await request(app).post("/api/auth/sign-up/email").send(user);
  expect(res.status).toBe(200);
}

async function requestOtp(email: string): Promise<string> {
  const before = testOutbox.length;
  const res = await request(app)
    .post("/api/auth/email-otp/send-verification-otp")
    .send({ email, type: "email-verification" });
  expect(res.status).toBe(200);
  const sent = testOutbox.slice(before).find((e) => e.to === email);
  expect(sent, "OTP email should be captured in the test outbox").toBeDefined();
  expect(sent!.subject).toBe("Your ScoreCast verification code");
  const match = sent!.html.match(/data-otp[^>]*>(\d{6})</);
  expect(match, "email should contain a 6-digit code").not.toBeNull();
  return match![1] as string;
}

describe("Email verification OTP", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    await initializeDatabase();
  });

  it("verifies an email end-to-end: signup -> code -> verify -> sign-in unlocked", async () => {
    const user = makeUser("happy");
    await signUp(user);

    // Unverified password sign-in is blocked (requireEmailVerification)
    const blocked = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: user.email, password: user.password });
    expect(blocked.status).toBe(403);

    const otp = await requestOtp(user.email);

    // Wrong code is rejected and does not verify
    const wrong = await request(app)
      .post("/api/auth/email-otp/verify-email")
      .send({ email: user.email, otp: otp === "000000" ? "111111" : "000000" });
    expect(wrong.status).toBeGreaterThanOrEqual(400);

    // Correct code verifies
    const ok = await request(app)
      .post("/api/auth/email-otp/verify-email")
      .send({ email: user.email, otp });
    expect(ok.status).toBe(200);

    const row = await queryOne<{ emailVerified: boolean }>(
      `SELECT "emailVerified" FROM "user" WHERE email = $1`,
      [user.email]
    );
    expect(row?.emailVerified).toBe(true);

    // Password sign-in now works
    const signIn = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: user.email, password: user.password });
    expect(signIn.status).toBe(200);
  });

  it("rejects an expired code", async () => {
    const user = makeUser("expired");
    await signUp(user);
    const otp = await requestOtp(user.email);

    await query(
      `UPDATE verification SET "expiresAt" = NOW() - INTERVAL '1 minute'
       WHERE identifier LIKE '%' || $1`,
      [user.email]
    );

    const res = await request(app)
      .post("/api/auth/email-otp/verify-email")
      .send({ email: user.email, otp });
    expect(res.status).toBeGreaterThanOrEqual(400);

    const row = await queryOne<{ emailVerified: boolean }>(
      `SELECT "emailVerified" FROM "user" WHERE email = $1`,
      [user.email]
    );
    expect(row?.emailVerified).toBe(false);
  });

  it("locks out after allowedAttempts wrong codes, even given the right one", async () => {
    const user = makeUser("attempts");
    await signUp(user);
    const otp = await requestOtp(user.email);
    const wrongOtp = otp === "999999" ? "888888" : "999999";

    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post("/api/auth/email-otp/verify-email")
        .send({ email: user.email, otp: wrongOtp });
      expect(res.status).toBeGreaterThanOrEqual(400);
    }

    const afterLockout = await request(app)
      .post("/api/auth/email-otp/verify-email")
      .send({ email: user.email, otp });
    expect(afterLockout.status).toBeGreaterThanOrEqual(400);

    const row = await queryOne<{ emailVerified: boolean }>(
      `SELECT "emailVerified" FROM "user" WHERE email = $1`,
      [user.email]
    );
    expect(row?.emailVerified).toBe(false);
  });

  it("re-requesting a code invalidates the previous one", async () => {
    const user = makeUser("resend");
    await signUp(user);
    const first = await requestOtp(user.email);
    const second = await requestOtp(user.email);

    if (first !== second) {
      const res = await request(app)
        .post("/api/auth/email-otp/verify-email")
        .send({ email: user.email, otp: first });
      expect(res.status).toBeGreaterThanOrEqual(400);
    }

    const ok = await request(app)
      .post("/api/auth/email-otp/verify-email")
      .send({ email: user.email, otp: second });
    expect(ok.status).toBe(200);
  });

  it("signup still sends the legacy link email alongside (transition period)", async () => {
    const before = testOutbox.length;
    const user = makeUser("legacy");
    await signUp(user);
    const linkEmail = testOutbox
      .slice(before)
      .find((e) => e.to === user.email && e.subject === "Verify your ScoreCast account");
    expect(linkEmail).toBeDefined();
    // callbackURL carries ?verified=true, URL-encoded inside the link
    expect(linkEmail!.html).toContain("verified%3Dtrue");
  });
});
