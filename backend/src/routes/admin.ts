import { Router } from "express";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { requireAdmin } from "../lib/admin.js";
import {
  syncCompetition,
  syncAll,
  syncTeams,
  updateMatchResults,
} from "../services/footballData.js";
import { scorePredictionsForMatch } from "./predictions.js";
import { queryAll, queryOne, query, withTransaction } from "../db.js";

const router = Router();

// Sync all competitions
router.post("/sync/all", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await syncAll();
    res.json({
      success: true,
      message: "Synced all competitions",
      data: result,
    });
  } catch (err: any) {
    console.error("Failed to sync all:", err);
    res.status(500).json({ error: err.message || "Failed to sync" });
  }
});

// Sync a specific competition
router.post("/sync/:competition", requireAuth, requireAdmin, async (req, res) => {
  const { competition } = req.params;

  if (competition !== "premier_league" && competition !== "champions_league") {
    res.status(400).json({ error: "Invalid competition" });
    return;
  }

  try {
    const result = await syncCompetition(competition);
    res.json({
      success: true,
      message: `Synced ${competition}`,
      data: result,
    });
  } catch (err: any) {
    console.error(`Failed to sync ${competition}:`, err);
    res.status(500).json({ error: err.message || "Failed to sync" });
  }
});

// Sync only teams
router.post("/sync/:competition/teams", requireAuth, requireAdmin, async (req, res) => {
  const { competition } = req.params;

  if (competition !== "premier_league" && competition !== "champions_league") {
    res.status(400).json({ error: "Invalid competition" });
    return;
  }

  try {
    const count = await syncTeams(competition);
    res.json({
      success: true,
      message: `Synced ${count} teams for ${competition}`,
    });
  } catch (err: any) {
    console.error(`Failed to sync teams:`, err);
    res.status(500).json({ error: err.message || "Failed to sync teams" });
  }
});

// Update match results and score predictions
router.post("/sync/:competition/results", requireAuth, requireAdmin, async (req, res) => {
  const { competition } = req.params;

  if (competition !== "premier_league" && competition !== "champions_league") {
    res.status(400).json({ error: "Invalid competition" });
    return;
  }

  try {
    const updated = await updateMatchResults(competition);

    // Re-score ALL predictions for finished matches in this competition
    // This handles both new scores and corrections to wrong scores
    const finishedMatches = await queryAll<{ id: string }>(
      `SELECT DISTINCT m.id FROM match m
       JOIN prediction p ON p."matchId" = m.id
       WHERE m.id LIKE $1 AND m.status = 'finished'`,
      [`${competition}-%`]
    );

    let scored = 0;
    for (const match of finishedMatches) {
      await scorePredictionsForMatch(match.id);
      scored++;
    }

    res.json({
      success: true,
      message: `Updated ${updated} results, re-scored ${scored} matches`,
      data: { updated, scored },
    });
  } catch (err: any) {
    console.error(`Failed to update results:`, err);
    res.status(500).json({ error: err.message || "Failed to update results" });
  }
});

// Get sync status
router.get("/status", requireAuth, requireAdmin, async (req, res) => {
  try {
    const plTeams = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM team WHERE competition = 'premier_league'`
    );
    const plSeasons = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM season WHERE competition = 'premier_league'`
    );
    const plGameweeks = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM gameweek g
       JOIN season s ON g."seasonId" = s.id
       WHERE s.competition = 'premier_league' AND s."isCurrent" = true`
    );
    const plMatches = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM match m
       JOIN matchday md ON m."matchdayId" = md.id
       JOIN gameweek g ON md."gameweekId" = g.id
       JOIN season s ON g."seasonId" = s.id
       WHERE s.competition = 'premier_league' AND s."isCurrent" = true`
    );

    const clTeams = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM team WHERE competition = 'champions_league'`
    );
    const clSeasons = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM season WHERE competition = 'champions_league'`
    );
    const clGameweeks = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM gameweek g
       JOIN season s ON g."seasonId" = s.id
       WHERE s.competition = 'champions_league' AND s."isCurrent" = true`
    );
    const clMatches = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM match m
       JOIN matchday md ON m."matchdayId" = md.id
       JOIN gameweek g ON md."gameweekId" = g.id
       JOIN season s ON g."seasonId" = s.id
       WHERE s.competition = 'champions_league' AND s."isCurrent" = true`
    );

    const stats = {
      premier_league: {
        teams: parseInt(plTeams?.count ?? "0", 10),
        seasons: parseInt(plSeasons?.count ?? "0", 10),
        gameweeks: parseInt(plGameweeks?.count ?? "0", 10),
        matches: parseInt(plMatches?.count ?? "0", 10),
      },
      champions_league: {
        teams: parseInt(clTeams?.count ?? "0", 10),
        seasons: parseInt(clSeasons?.count ?? "0", 10),
        gameweeks: parseInt(clGameweeks?.count ?? "0", 10),
        matches: parseInt(clMatches?.count ?? "0", 10),
      },
    };

    res.json(stats);
  } catch (err: any) {
    console.error("Failed to get status:", err);
    res.status(500).json({ error: err.message || "Failed to get status" });
  }
});

// ── League-creation grants (AD2) ─────────────────────────────────────────────

// Search users to grant (by username / email / name). Min 2 chars.
router.get("/users", requireAuth, requireAdmin, async (req, res) => {
  const q = String(req.query.q ?? "").trim().toLowerCase();
  if (q.length < 2) {
    res.json([]);
    return;
  }
  try {
    const like = `%${q}%`;
    const rows = await queryAll(
      `SELECT u.id, u.username, u.email, u."firstName", u."lastName",
              EXISTS(SELECT 1 FROM league_creation_grant g WHERE g."userId" = u.id AND g.used = false) AS "hasPendingGrant"
         FROM "user" u
        WHERE lower(u.username) LIKE $1 OR lower(u.email) LIKE $1 OR lower(u.name) LIKE $1
        ORDER BY u.username NULLS LAST
        LIMIT 25`,
      [like]
    );
    res.json(rows);
  } catch (err: any) {
    console.error("Failed to search users:", err);
    res.status(500).json({ error: err.message || "Failed to search users" });
  }
});

// List all grants (pending + used), newest first.
router.get("/grants", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const rows = await queryAll(
      `SELECT g.id, g."userId", g.used, g."usedLeagueId", g."createdAt", g."usedAt",
              u.username, u.email, l.name AS "leagueName"
         FROM league_creation_grant g
         JOIN "user" u ON u.id = g."userId"
         LEFT JOIN league l ON l.id = g."usedLeagueId"
        ORDER BY g."createdAt" DESC
        LIMIT 200`
    );
    res.json(rows);
  } catch (err: any) {
    console.error("Failed to list grants:", err);
    res.status(500).json({ error: err.message || "Failed to list grants" });
  }
});

// Grant a user one league creation (at most one pending per user).
router.post("/grants", requireAuth, requireAdmin, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { userId } = req.body;
  if (!userId || typeof userId !== "string") {
    res.status(400).json({ error: "userId is required" });
    return;
  }
  try {
    const target = await queryOne(`SELECT id FROM "user" WHERE id = $1`, [userId]);
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const existing = await queryOne(
      `SELECT id FROM league_creation_grant WHERE "userId" = $1 AND used = false`,
      [userId]
    );
    if (existing) {
      res.status(409).json({ error: "That user already has a pending grant" });
      return;
    }
    const id = crypto.randomUUID();
    await query(
      `INSERT INTO league_creation_grant (id, "userId", "grantedBy") VALUES ($1, $2, $3)`,
      [id, userId, user.id]
    );
    res.status(201).json({ success: true, id });
  } catch (err: any) {
    console.error("Failed to grant creation:", err);
    res.status(500).json({ error: err.message || "Failed to grant creation" });
  }
});

// Revoke a pending (unused) grant.
router.delete("/grants/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const g = await queryOne<{ used: boolean }>(
      `SELECT used FROM league_creation_grant WHERE id = $1`,
      [id]
    );
    if (!g) {
      res.status(404).json({ error: "Grant not found" });
      return;
    }
    if (g.used) {
      res.status(400).json({ error: "That grant has already been used" });
      return;
    }
    await query(`DELETE FROM league_creation_grant WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Failed to revoke grant:", err);
    res.status(500).json({ error: err.message || "Failed to revoke grant" });
  }
});

// ── Leagues overview (AD6) ───────────────────────────────────────────────────

// Every league with its creator + member count.
router.get("/leagues", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const rows = await queryAll(
      `SELECT l.id, l.name, l.type, l."inviteCode", l."createdBy", l."createdAt",
              u.username AS "creatorUsername", u.email AS "creatorEmail",
              (SELECT COUNT(*) FROM league_member WHERE "leagueId" = l.id) AS "memberCount"
         FROM league l
         LEFT JOIN "user" u ON u.id = l."createdBy"
        ORDER BY l."createdAt" DESC
        LIMIT 500`
    );
    res.json(rows);
  } catch (err: any) {
    console.error("Failed to list leagues:", err);
    res.status(500).json({ error: err.message || "Failed to list leagues" });
  }
});

// Delete a league (super-admin only). Explicit child deletes in a transaction.
router.delete("/leagues/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const league = await queryOne(`SELECT id FROM league WHERE id = $1`, [id]);
    if (!league) {
      res.status(404).json({ error: "League not found" });
      return;
    }
    await withTransaction(async (client) => {
      await client.query(`DELETE FROM prediction WHERE "leagueId" = $1`, [id]);
      await client.query(`DELETE FROM league_member WHERE "leagueId" = $1`, [id]);
      await client.query(`DELETE FROM prize_pool WHERE "leagueId" = $1`, [id]);
      await client.query(`DELETE FROM league WHERE id = $1`, [id]);
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Failed to delete league:", err);
    res.status(500).json({ error: err.message || "Failed to delete league" });
  }
});

export default router;
