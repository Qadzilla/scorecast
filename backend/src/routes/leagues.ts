import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import crypto from "crypto";

const router = Router();

// Admin email - only this user can create leagues (set via ADMIN_EMAIL env var)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";

// Valid league types
const LEAGUE_TYPES = ["premier_league", "champions_league"] as const;
type LeagueType = typeof LEAGUE_TYPES[number];

// Generate a random invite code
function generateInviteCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

// Create a new league
router.post("/", requireAuth, (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { name, description, type } = req.body;

  // Only admin can create leagues
  if (user.email !== ADMIN_EMAIL) {
    res.status(403).json({ error: "Only the admin can create leagues" });
    return;
  }

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "League name is required" });
    return;
  }

  if (name.length > 100) {
    res.status(400).json({ error: "League name must be less than 100 characters" });
    return;
  }

  if (description && description.length > 500) {
    res.status(400).json({ error: "Description must be less than 500 characters" });
    return;
  }

  if (!type || !LEAGUE_TYPES.includes(type)) {
    res.status(400).json({ error: "League type must be 'premier_league' or 'champions_league'" });
    return;
  }

  const leagueId = crypto.randomUUID();
  const inviteCode = generateInviteCode();
  const now = new Date().toISOString();

  try {
    // Create the league
    db.prepare(`
      INSERT INTO league (id, name, description, type, inviteCode, createdBy, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(leagueId, name.trim(), description?.trim() || null, type, inviteCode, user.id, now, now);

    // Add creator as admin member
    const memberId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO league_member (id, leagueId, userId, role, joinedAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(memberId, leagueId, user.id, "admin", now);

    res.status(201).json({
      id: leagueId,
      name: name.trim(),
      description: description?.trim() || null,
      type,
      inviteCode,
      createdBy: user.id,
      createdAt: now,
      role: "admin",
    });
  } catch (err) {
    console.error("Failed to create league:", err);
    res.status(500).json({ error: "Failed to create league" });
  }
});

// Join a league via invite code
router.post("/join", requireAuth, (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { inviteCode } = req.body;

  if (!inviteCode || typeof inviteCode !== "string") {
    res.status(400).json({ error: "Invite code is required" });
    return;
  }

  try {
    // Find league by invite code
    const league = db.prepare(`
      SELECT id, name, description, inviteCode, createdBy, createdAt
      FROM league WHERE inviteCode = ?
    `).get(inviteCode.toUpperCase()) as { id: string; name: string; description: string; inviteCode: string; createdBy: string; createdAt: string } | undefined;

    if (!league) {
      res.status(404).json({ error: "Invalid invite code" });
      return;
    }

    // Check if already a member
    const existingMember = db.prepare(`
      SELECT id FROM league_member WHERE leagueId = ? AND userId = ?
    `).get(league.id, user.id);

    if (existingMember) {
      res.status(400).json({ error: "You are already a member of this league" });
      return;
    }

    // Add user as member
    const memberId = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO league_member (id, leagueId, userId, role, joinedAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(memberId, league.id, user.id, "member", now);

    res.status(200).json({
      id: league.id,
      name: league.name,
      description: league.description,
      role: "member",
      joinedAt: now,
    });
  } catch (err) {
    console.error("Failed to join league:", err);
    res.status(500).json({ error: "Failed to join league" });
  }
});

// Get user's leagues
router.get("/", requireAuth, (req, res) => {
  const { user } = req as AuthenticatedRequest;

  try {
    const leagues = db.prepare(`
      SELECT
        l.id,
        l.name,
        l.description,
        l.type,
        l.inviteCode,
        l.createdBy,
        l.createdAt,
        lm.role,
        lm.joinedAt,
        (SELECT COUNT(*) FROM league_member WHERE leagueId = l.id) as memberCount
      FROM league l
      JOIN league_member lm ON l.id = lm.leagueId
      WHERE lm.userId = ?
      ORDER BY lm.joinedAt DESC
    `).all(user.id);

    res.json(leagues);
  } catch (err) {
    console.error("Failed to fetch leagues:", err);
    res.status(500).json({ error: "Failed to fetch leagues" });
  }
});

export default router;
