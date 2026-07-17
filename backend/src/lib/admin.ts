import type { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { queryOne } from "../db.js";

// Single source of truth for "who is an admin".
//
// Canonical var is ADMIN_EMAILS (comma-separated). ADMIN_EMAIL (singular)
// is read as a deprecation fallback for one deploy — the two routes used to
// disagree (admin.ts read ADMIN_EMAILS, leagues.ts read ADMIN_EMAIL), and
// leagues.ts compared case-sensitively, which could lock out an admin whose
// stored email differed only in case. Both now go through this helper, which
// matches case-insensitively.
function adminEmailList(): string[] {
  return `${process.env.ADMIN_EMAILS || ""},${process.env.ADMIN_EMAIL || ""}`
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmailList().includes(email.toLowerCase());
}

// Per-league admin (AD1): the user's role in THIS league is 'admin' (i.e. they
// created it). League-scoped actions gate on `isAdmin(email) || isLeagueAdmin(...)`
// so a league's own creator manages it, with the global admin as an override.
export async function isLeagueAdmin(userId: string, leagueId: string): Promise<boolean> {
  const row = await queryOne(
    `SELECT 1 AS ok FROM league_member WHERE "leagueId" = $1 AND "userId" = $2 AND role = 'admin'`,
    [leagueId, userId]
  );
  return !!row;
}

// Express middleware — 403s non-admins. Assumes requireAuth ran first.
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const { user } = req as AuthenticatedRequest;
  if (!isAdmin(user?.email)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
