import { describe, it, expect, beforeAll } from "vitest";
import crypto from "crypto";
import request from "supertest";
import { app } from "../app.js";
import { query, queryOne, initializeDatabase } from "../db.js";

// AD6: admin leagues overview + delete.

let admin: { id: string; cookie: string; email: string };

async function signUp(tag: string) {
  const s = `${tag}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`.toLowerCase();
  const email = `${s}@example.com`;
  const user = { name: "L Admin", email, password: "AdminPass123!", firstName: "L", lastName: "A", username: `${tag}_${Date.now() % 1e7}`.toLowerCase() };
  expect((await request(app).post("/api/auth/sign-up/email").send(user)).status).toBe(200);
  await query(`UPDATE "user" SET "emailVerified" = true WHERE email = $1`, [email]);
  const si = await request(app).post("/api/auth/sign-in/email").send({ email, password: user.password });
  expect(si.status).toBe(200);
  const id = (await queryOne<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [email]))!.id;
  const cookie = (Array.isArray(si.headers["set-cookie"]) ? si.headers["set-cookie"] : [si.headers["set-cookie"]]).join("; ");
  return { id, cookie, email };
}

async function makeLeague(createdBy: string): Promise<string> {
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO league (id, name, type, "inviteCode", "createdBy", "createdAt", "updatedAt")
     VALUES ($1, 'Overview League', 'premier_league', $2, $3, NOW(), NOW())`,
    [id, crypto.randomBytes(4).toString("hex").toUpperCase(), createdBy]
  );
  await query(
    `INSERT INTO league_member (id, "leagueId", "userId", role, "joinedAt") VALUES ($1, $2, $3, 'admin', NOW())`,
    [crypto.randomUUID(), id, createdBy]
  );
  return id;
}

describe("admin leagues overview (AD6)", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    await initializeDatabase();
    admin = await signUp("ladmin");
    process.env.ADMIN_EMAILS = admin.email;
  });

  it("lists leagues with creator + member count, and deletes one", async () => {
    const creator = await signUp("lcreator");
    const league = await makeLeague(creator.id);

    const list = await request(app).get("/api/admin/leagues").set("Cookie", admin.cookie);
    expect(list.status).toBe(200);
    const found = (list.body as any[]).find((l) => l.id === league);
    expect(found).toBeTruthy();
    expect(Number(found.memberCount)).toBe(1);

    const del = await request(app).delete(`/api/admin/leagues/${league}`).set("Cookie", admin.cookie);
    expect(del.status).toBe(200);

    // gone from DB (members cascaded)
    expect(await queryOne(`SELECT id FROM league WHERE id = $1`, [league])).toBeFalsy();
    expect(await queryOne(`SELECT id FROM league_member WHERE "leagueId" = $1`, [league])).toBeFalsy();
  });

  it("deleting a nonexistent league 404s", async () => {
    const res = await request(app).delete(`/api/admin/leagues/${crypto.randomUUID()}`).set("Cookie", admin.cookie);
    expect(res.status).toBe(404);
  });

  it("non-admin is blocked", async () => {
    const bob = await signUp("lbob");
    expect((await request(app).get("/api/admin/leagues").set("Cookie", bob.cookie)).status).toBe(403);
    const league = await makeLeague(bob.id);
    expect((await request(app).delete(`/api/admin/leagues/${league}`).set("Cookie", bob.cookie)).status).toBe(403);
  });
});
