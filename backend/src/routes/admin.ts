import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import {
  syncCompetition,
  syncAll,
  syncTeams,
  updateMatchResults,
} from "../services/footballData.js";
import { scorePredictionsForMatch } from "./predictions.js";
import { queryAll, queryOne } from "../db.js";

const router = Router();

// Simple admin check - in production you'd want proper role-based auth
const requireAdmin = (req: any, res: any, next: any) => {
  const { user } = req as AuthenticatedRequest;
  // For now, check against an env variable for admin emails
  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());

  if (!adminEmails.includes(user.email.toLowerCase())) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
};

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

    // Score predictions for finished matches
    const finishedMatches = await queryAll<{ id: string }>(
      `SELECT id FROM match
       WHERE id LIKE $1 AND status = 'finished'
       AND id IN (SELECT "matchId" FROM prediction WHERE points IS NULL)`,
      [`${competition}-%`]
    );

    let scored = 0;
    for (const match of finishedMatches) {
      await scorePredictionsForMatch(match.id);
      scored++;
    }

    res.json({
      success: true,
      message: `Updated ${updated} results, scored ${scored} matches`,
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

export default router;
