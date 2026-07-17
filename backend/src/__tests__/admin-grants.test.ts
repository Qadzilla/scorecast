import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { query, queryOne, initializeDatabase } from "../db.js";

// AD2: one-time league-creation grants — grant → create once → consumed.

let admin: { id: string; cookie: string; email: string; username: string };

async function signUp(tag: string) {
  const s = `${tag}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`.toLowerCase();
  const email = `${s}@example.com`;
  const username = `${tag}_${Date.now() % 1e7}`.toLowerCase();
  const user = { name: "Grant Tester", email, password: "GrantPass123!", firstName: "G", lastName: "T", username };
  expect((await request(app).post("/api/auth/sign-up/email").send(user)).status).toBe(200);
  await query(`UPDATE "user" SET "emailVerified" = true WHERE email = $1`, [email]);
  const si = await request(app).post("/api/auth/sign-in/email").send({ email, password: user.password });
  expect(si.status).toBe(200);
  const id = (await queryOne<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [email]))!.id;
  const cookie = (Array.isArray(si.headers["set-cookie"]) ? si.headers["set-cookie"] : [si.headers["set-cookie"]]).join("; ");
  return { id, cookie, email, username };
}

const me = (cookie: string) => request(app).get("/api/user/me").set("Cookie", cookie);
const createLeague = (cookie: string, name: string) =>
  request(app).post("/api/leagues").set("Cookie", cookie).send({ name, type: "premier_league" });
const grant = (cookie: string, userId: string) =>
  request(app).post("/api/admin/grants").set("Cookie", cookie).send({ userId });

describe("league-creation grants (AD2)", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    await initializeDatabase();
    admin = await signUp("grantadmin");
    process.env.ADMIN_EMAILS = admin.email;
  });

  it("grant → create once → consumed; second create blocked", async () => {
    const bob = await signUp("bob");

    // no permission initially
    expect((await me(bob.cookie)).body.canCreateLeague).toBe(false);
    expect((await createLeague(bob.cookie, "Bob League")).status).toBe(403);

    // admin grants bob
    expect((await grant(admin.cookie, bob.id)).status).toBe(201);
    expect((await me(bob.cookie)).body.canCreateLeague).toBe(true);

    // admin sees bob (with a pending grant) in search
    const search = await request(app).get(`/api/admin/users?q=bob`).set("Cookie", admin.cookie);
    expect(search.status).toBe(200);
    const found = (search.body as any[]).find((u) => u.id === bob.id);
    expect(found?.hasPendingGrant).toBe(true);

    // bob creates one league, which consumes the grant
    expect((await createLeague(bob.cookie, "Bob League")).status).toBe(201);
    expect((await me(bob.cookie)).body.canCreateLeague).toBe(false);

    // a second create is blocked again
    expect((await createLeague(bob.cookie, "Bob League 2")).status).toBe(403);

    // the grant shows used in the admin list
    const grants = await request(app).get(`/api/admin/grants`).set("Cookie", admin.cookie);
    const g = (grants.body as any[]).find((x) => x.userId === bob.id);
    expect(g?.used).toBe(true);
    expect(g?.leagueName).toBe("Bob League");
  });

  it("at most one pending grant per user (409)", async () => {
    const cara = await signUp("cara");
    expect((await grant(admin.cookie, cara.id)).status).toBe(201);
    expect((await grant(admin.cookie, cara.id)).status).toBe(409); // already pending
  });

  it("revoke a pending grant removes the permission", async () => {
    const dan = await signUp("dan");
    const g = await grant(admin.cookie, dan.id);
    expect(g.status).toBe(201);
    expect((await me(dan.cookie)).body.canCreateLeague).toBe(true);

    const del = await request(app).delete(`/api/admin/grants/${g.body.id}`).set("Cookie", admin.cookie);
    expect(del.status).toBe(200);
    expect((await me(dan.cookie)).body.canCreateLeague).toBe(false);
  });

  it("non-admin cannot grant", async () => {
    const eve = await signUp("eve");
    const target = await signUp("evetarget");
    expect((await grant(eve.cookie, target.id)).status).toBe(403);
  });
});
