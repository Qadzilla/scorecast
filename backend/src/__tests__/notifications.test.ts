import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { query, queryOne, initializeDatabase } from "../db.js";
import { notifyIfAllowed, pushTestOutbox } from "../services/push.js";
import { pushCopy } from "../services/pushCopy.js";

// NS1 — push infra: preference gating + push_log dedup + prefs endpoints.

function makeUser(tag: string) {
  const s = `${tag}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`.toLowerCase();
  return {
    name: "Push Tester",
    email: `${s}@example.com`,
    password: "PushPass123!",
    firstName: "Push",
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

async function userId(email: string): Promise<string> {
  const row = await queryOne<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [email]);
  return row!.id;
}

describe("NS1 — notifyIfAllowed (gate + dedup)", () => {
  let uid: string;
  const user = makeUser("notif");

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    await initializeDatabase();
    await signUpVerified(user);
    uid = await userId(user.email);
  });

  beforeEach(() => {
    pushTestOutbox.length = 0;
  });

  it("dedups a repeated (user, kind, subject, league) notification", async () => {
    const msg = pushCopy.resultSingle("ARS", 2, "CHE", 1, 3);
    const first = await notifyIfAllowed({
      userId: uid, kind: "results", subjectId: "match-A", leagueId: "lg-1", message: msg,
    });
    const second = await notifyIfAllowed({
      userId: uid, kind: "results", subjectId: "match-A", leagueId: "lg-1", message: msg,
    });
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(pushTestOutbox.length).toBe(1);
  });

  it("treats a different league as a separate notification", async () => {
    const msg = pushCopy.resultSingle("ARS", 2, "CHE", 1, 3);
    await notifyIfAllowed({ userId: uid, kind: "results", subjectId: "match-B", leagueId: "lg-1", message: msg });
    await notifyIfAllowed({ userId: uid, kind: "results", subjectId: "match-B", leagueId: "lg-2", message: msg });
    expect(pushTestOutbox.length).toBe(2);
  });

  it("respects a disabled preference category", async () => {
    await query(
      `INSERT INTO notification_pref (user_id, deadlines, results, updates)
       VALUES ($1, true, false, true)
       ON CONFLICT (user_id) DO UPDATE SET results = false`,
      [uid]
    );
    const sent = await notifyIfAllowed({
      userId: uid, kind: "results", subjectId: "match-C", leagueId: "lg-1",
      message: pushCopy.resultSingle("ARS", 1, "CHE", 0, 1),
    });
    expect(sent).toBe(false);
    expect(pushTestOutbox.length).toBe(0);

    // A different category (deadlines) is still allowed.
    const allowed = await notifyIfAllowed({
      userId: uid, kind: "deadline_1h", subjectId: "gw-1", leagueId: "lg-1",
      message: pushCopy.deadline1h(1, "Kickoff Kings"),
    });
    expect(allowed).toBe(true);
    expect(pushTestOutbox.length).toBe(1);
  });
});

describe("NS1 — /api/notifications/prefs", () => {
  let cookie: string;
  const user = makeUser("prefs");

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    await initializeDatabase();
    cookie = await signUpVerified(user);
  });

  it("requires auth", async () => {
    const res = await request(app).get("/api/notifications/prefs");
    expect(res.status).toBe(401);
  });

  it("defaults to all-on for a new user", async () => {
    const res = await request(app).get("/api/notifications/prefs").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deadlines: true, results: true, updates: true });
  });

  it("upserts and reflects changes", async () => {
    const put = await request(app)
      .put("/api/notifications/prefs")
      .set("Cookie", cookie)
      .send({ deadlines: false, results: true, updates: false });
    expect(put.status).toBe(200);
    expect(put.body).toEqual({ deadlines: false, results: true, updates: false });

    const get = await request(app).get("/api/notifications/prefs").set("Cookie", cookie);
    expect(get.body).toEqual({ deadlines: false, results: true, updates: false });
  });
});
