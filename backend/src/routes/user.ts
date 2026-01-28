import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

// Get all teams (for team selection) - deduplicated by name
router.get("/teams", requireAuth, (_req, res) => {
  try {
    // Use GROUP BY to deduplicate teams that appear in both PL and UCL
    // Prefer premier_league version over champions_league
    const teams = db.prepare(`
      SELECT id, name, shortName, code, logo, competition
      FROM team
      WHERE id IN (
        SELECT id FROM team t1
        WHERE NOT EXISTS (
          SELECT 1 FROM team t2
          WHERE t2.name = t1.name
          AND t2.competition = 'premier_league'
          AND t1.competition = 'champions_league'
        )
      )
      ORDER BY name ASC
    `).all();

    res.json(teams);
  } catch (err) {
    console.error("Failed to fetch teams:", err);
    res.status(500).json({ error: "Failed to fetch teams" });
  }
});

// Get current user's favorite team
router.get("/favorite-team", requireAuth, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user.id;

  try {
    const user = db.prepare(`
      SELECT favoriteTeamId FROM user WHERE id = ?
    `).get(userId) as { favoriteTeamId: string | null } | undefined;

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (!user.favoriteTeamId) {
      res.json({ favoriteTeamId: null, team: null });
      return;
    }

    const team = db.prepare(`
      SELECT id, name, shortName, code, logo, competition
      FROM team WHERE id = ?
    `).get(user.favoriteTeamId);

    res.json({ favoriteTeamId: user.favoriteTeamId, team });
  } catch (err) {
    console.error("Failed to fetch favorite team:", err);
    res.status(500).json({ error: "Failed to fetch favorite team" });
  }
});

// Update username
router.put("/username", requireAuth, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user.id;
  const { username } = req.body;

  if (!username || typeof username !== "string") {
    res.status(400).json({ error: "Username is required" });
    return;
  }

  const trimmedUsername = username.trim().toLowerCase();

  if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
    res.status(400).json({ error: "Username must be between 3 and 20 characters" });
    return;
  }

  if (!/^[a-z0-9_]+$/.test(trimmedUsername)) {
    res.status(400).json({ error: "Username can only contain letters, numbers, and underscores" });
    return;
  }

  try {
    // Check if username is already taken by another user
    const existing = db.prepare(`
      SELECT id FROM user WHERE username = ? AND id != ?
    `).get(trimmedUsername, userId);

    if (existing) {
      res.status(409).json({ error: "Username is already taken" });
      return;
    }

    // Update username
    db.prepare(`
      UPDATE user SET username = ? WHERE id = ?
    `).run(trimmedUsername, userId);

    res.json({ success: true, username: trimmedUsername });
  } catch (err) {
    console.error("Failed to update username:", err);
    res.status(500).json({ error: "Failed to update username" });
  }
});

// Set favorite team
router.post("/favorite-team", requireAuth, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user.id;
  const { teamId } = req.body;

  if (!teamId || typeof teamId !== "string") {
    res.status(400).json({ error: "Team ID is required" });
    return;
  }

  try {
    // Verify team exists
    const team = db.prepare(`
      SELECT id, name, shortName, code, logo, competition
      FROM team WHERE id = ?
    `).get(teamId);

    if (!team) {
      res.status(404).json({ error: "Team not found" });
      return;
    }

    // Update user's favorite team
    db.prepare(`
      UPDATE user SET favoriteTeamId = ? WHERE id = ?
    `).run(teamId, userId);

    res.json({ success: true, team });
  } catch (err) {
    console.error("Failed to set favorite team:", err);
    res.status(500).json({ error: "Failed to set favorite team" });
  }
});

export default router;
