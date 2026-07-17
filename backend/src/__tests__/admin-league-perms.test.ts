import { describe, it, expect, beforeAll } from "vitest";
import crypto from "crypto";
import request from "supertest";
import { app } from "../app.js";
import { query, queryOne, initializeDatabase } from "../db.js";

// AD1: league-scoped actions gate on isAdmin(email) OR isLeagueAdmin (role='admin'
// for that league), not the global allowlist alone.

let globalAdmin: { id: string; cookie: string; email: string };

async function signUp(tag: string): Promise<{ id: string; cookie: string; email: string }> {
  const s = `${tag}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`.toLowerCase();
  const email = `${s}@example.com`;
  const user = {
    name: "Perm Tester", email, password: "PermPass123!",
    firstName: "P", lastName: "T", username: `${tag}_${Date.now() % 1e7}`.toLowerCase(),
  };
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
     VALUES ($1, 'Perm League', 'premier_league', $2, $3, NOW(), NOW())`,
    [id, crypto.randomBytes(4).toString("hex").toUpperCase(), createdBy]
  );
  return id;
}

async function addMember(leagueId: string, userId: string, role: "admin" | "member") {
  await query(
    `INSERT INTO league_member (id, "leagueId", "userId", role, "joinedAt") VALUES ($1, $2, $3, $4, NOW())`,
    [crypto.randomUUID(), leagueId, userId, role]
  );
}

const rename = (leagueId: string, cookie: string) =>
  request(app).patch(`/api/leagues/${leagueId}`).set("Cookie", cookie).send({ name: "Renamed League" });

describe("per-league admin permissions (AD1)", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    await initializeDatabase();
    globalAdmin = await signUp("gadmin");
    process.env.ADMIN_EMAILS = globalAdmin.email;
  });

  it("the league's own admin can manage it; members and outsiders cannot", async () => {
    const creator = await signUp("creator"); // role=admin in the league
    const member = await signUp("member"); // role=member
    const outsider = await signUp("outsider"); // not in the league
    const league = await makeLeague(creator.id);
    await addMember(league, creator.id, "admin");
    await addMember(league, member.id, "member");

    // creator (league admin) can rename + view members + kick
    expect((await rename(league, creator.cookie)).status).toBe(200);
    expect((await request(app).get(`/api/leagues/${league}/members`).set("Cookie", creator.cookie)).status).toBe(200);
    expect((await request(app).delete(`/api/leagues/${league}/members/${member.id}`).set("Cookie", creator.cookie)).status).toBe(200);

    // a plain member cannot
    expect((await rename(league, member.cookie)).status).toBe(403);
    // (member was kicked above; re-add to test the members-list gate directly)
    await addMember(league, member.id, "member");
    expect((await request(app).get(`/api/leagues/${league}/members`).set("Cookie", member.cookie)).status).toBe(403);

    // an outsider cannot
    expect((await rename(league, outsider.cookie)).status).toBe(403);
  });

  it("the global admin can manage any league even without membership", async () => {
    const creator = await signUp("c2");
    const league = await makeLeague(creator.id);
    await addMember(league, creator.id, "admin");
    // globalAdmin is NOT a member, but ADMIN_EMAILS lists them
    expect((await rename(league, globalAdmin.cookie)).status).toBe(200);
  });
});
