import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { query, queryOne, initializeDatabase } from "../db.js";

// MS5 (account deletion) + MS6 (push-token registry) — MOBILE_PLAN.md §4.3/§4.5.

function makeUser(tag: string) {
  const s = `${tag}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`.toLowerCase();
  return {
    name: "Del Tester",
    // Lowercase: better-auth normalizes emails on storage, so a mixed-case
    // address here would not match a WHERE email = ... lookup afterwards.
    email: `${s}@example.com`,
    password: "DeletePass123!",
    firstName: "Del",
    lastName: "Tester",
    username: `${tag}_${Date.now() % 1e7}`.toLowerCase(),
  };
}

async function signUpVerified(user: Record<string, string>): Promise<string> {
  const res = await request(app).post("/api/auth/sign-up/email").send(user);
  expect(res.status).toBe(200);
  await query(`UPDATE "user" SET "emailVerified" = true WHERE email = $1`, [user.email]);
  const signIn = await request(app)
    .post("/api/auth/sign-in/email")
    .send({ email: user.email, password: user.password });
  expect(signIn.status).toBe(200);
  const cookie = signIn.headers["set-cookie"];
  return (Array.isArray(cookie) ? cookie : [cookie]).join("; ");
}

async function userId(email: string): Promise<string | null> {
  const row = await queryOne<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [email]);
  return row?.id ?? null;
}

describe("MS6 — push token registry", () => {
  let cookie: string;
  const user = makeUser("push");

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    await initializeDatabase();
    cookie = await signUpVerified(user);
  });

  it("requires auth", async () => {
    const res = await request(app).post("/api/push/register").send({ token: "x", platform: "ios" });
    expect(res.status).toBe(401);
  });

  it("rejects a bad platform", async () => {
    const res = await request(app)
      .post("/api/push/register")
      .set("Cookie", cookie)
      .send({ token: "ExponentPushToken[abc]", platform: "windows" });
    expect(res.status).toBe(400);
  });

  it("registers and upserts on the same token (no duplicate rows)", async () => {
    const token = `ExponentPushToken[${user.username}]`;
    for (let i = 0; i < 2; i++) {
      const res = await request(app)
        .post("/api/push/register")
        .set("Cookie", cookie)
        .send({ token, platform: "ios" });
      expect(res.status).toBe(200);
    }
    const count = await queryOne<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM push_token WHERE token = $1`,
      [token]
    );
    expect(count?.n).toBe("1");
  });

  it("unregisters a token", async () => {
    const token = `ExponentPushToken[unreg_${user.username}]`;
    await request(app).post("/api/push/register").set("Cookie", cookie).send({ token, platform: "android" });
    const del = await request(app).delete("/api/push/register").set("Cookie", cookie).send({ token });
    expect(del.status).toBe(200);
    const count = await queryOne<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM push_token WHERE token = $1`,
      [token]
    );
    expect(count?.n).toBe("0");
  });
});

describe("MS5 — account deletion", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    await initializeDatabase();
  });

  it("requires auth", async () => {
    const res = await request(app).delete("/api/user/account");
    expect(res.status).toBe(401);
  });

  it("deletes the user and cascades memberships + push tokens; leagues they created are NOT theirs so survive", async () => {
    // An admin creates a league; a member joins it, gets a push token, then deletes.
    const admin = makeUser("delA");
    process.env.ADMIN_EMAILS = admin.email;
    const adminCookie = await signUpVerified(admin);
    const created = await request(app)
      .post("/api/leagues")
      .set("Cookie", adminCookie)
      .send({ name: "Survivor League", type: "premier_league" });
    expect(created.status).toBe(201);
    const inviteCode = created.body.inviteCode as string;

    const member = makeUser("delM");
    const memberCookie = await signUpVerified(member);
    const joined = await request(app)
      .post("/api/leagues/join")
      .set("Cookie", memberCookie)
      .send({ inviteCode });
    expect(joined.status).toBe(200);

    const memberId = await userId(member.email);
    await request(app)
      .post("/api/push/register")
      .set("Cookie", memberCookie)
      .send({ token: `ExponentPushToken[del_${member.username}]`, platform: "ios" });

    // Sanity: membership + token exist
    expect(
      (await queryOne<{ n: string }>(`SELECT COUNT(*)::text AS n FROM league_member WHERE "userId" = $1`, [memberId]))?.n
    ).toBe("1");
    expect(
      (await queryOne<{ n: string }>(`SELECT COUNT(*)::text AS n FROM push_token WHERE "userId" = $1`, [memberId]))?.n
    ).toBe("1");

    const del = await request(app).delete("/api/user/account").set("Cookie", memberCookie);
    expect(del.status).toBe(200);

    // User gone; children cascaded away
    expect(await userId(member.email)).toBeNull();
    expect(
      (await queryOne<{ n: string }>(`SELECT COUNT(*)::text AS n FROM league_member WHERE "userId" = $1`, [memberId]))?.n
    ).toBe("0");
    expect(
      (await queryOne<{ n: string }>(`SELECT COUNT(*)::text AS n FROM push_token WHERE "userId" = $1`, [memberId]))?.n
    ).toBe("0");

    // The admin's league still exists (its creator wasn't deleted)
    const league = await queryOne<{ id: string }>(`SELECT id FROM league WHERE "inviteCode" = $1`, [inviteCode]);
    expect(league).not.toBeNull();

    // The deleted user's cookie no longer yields a profile. Note better-auth's
    // cookieCache (5 min) may still pass requireAuth on the stale signed cookie,
    // in which case /me hits the DB and 404s on the missing user; a cache miss
    // 401s at the session check. Either means "no longer a valid user" — the
    // client signs out locally on delete regardless.
    const meAfter = await request(app).get("/api/user/me").set("Cookie", memberCookie);
    expect([401, 404]).toContain(meAfter.status);
  });

  it("nulls createdBy when the league creator is deleted (leagues survive)", async () => {
    const creator = makeUser("delC");
    process.env.ADMIN_EMAILS = creator.email;
    const creatorCookie = await signUpVerified(creator);
    const created = await request(app)
      .post("/api/leagues")
      .set("Cookie", creatorCookie)
      .send({ name: "Orphan League", type: "champions_league" });
    expect(created.status).toBe(201);
    const inviteCode = created.body.inviteCode as string;

    const del = await request(app).delete("/api/user/account").set("Cookie", creatorCookie);
    expect(del.status).toBe(200);

    const league = await queryOne<{ createdBy: string | null }>(
      `SELECT "createdBy" FROM league WHERE "inviteCode" = $1`,
      [inviteCode]
    );
    expect(league).not.toBeNull();
    expect(league?.createdBy).toBeNull();
  });
});
