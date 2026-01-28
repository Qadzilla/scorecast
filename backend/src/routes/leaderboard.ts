import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  totalPoints: number;
  exactScores: number;
  correctResults: number;
  gameweeksPlayed: number;
  teamLogo: string | null;
}

// Get league leaderboard
router.get("/:leagueId", requireAuth, (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { leagueId } = req.params;

  try {
    // Verify user is member of league
    const member = db.prepare(`
      SELECT id FROM league_member WHERE leagueId = ? AND userId = ?
    `).get(leagueId, user.id);

    if (!member) {
      res.status(403).json({ error: "You are not a member of this league" });
      return;
    }

    // Get league type to check season status
    const league = db.prepare(`
      SELECT type FROM league WHERE id = ?
    `).get(leagueId) as { type: string } | undefined;

    // Check if season is complete
    let isSeasonComplete = false;
    if (league) {
      const season = db.prepare(`
        SELECT id FROM season WHERE competition = ? AND isCurrent = 1
      `).get(league.type) as { id: string } | undefined;

      if (season) {
        const gameweekStats = db.prepare(`
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
          FROM gameweek
          WHERE seasonId = ?
        `).get(season.id) as { total: number; completed: number };

        isSeasonComplete = gameweekStats.total > 0 && gameweekStats.total === gameweekStats.completed;
      }
    }

    // Get all members with their total points
    const standings = db.prepare(`
      SELECT
        u.id as userId,
        u.username,
        u.firstName,
        u.lastName,
        t.logo as teamLogo,
        COALESCE(SUM(p.points), 0) as totalPoints,
        COALESCE(SUM(CASE WHEN p.points = 3 THEN 1 ELSE 0 END), 0) as exactScores,
        COALESCE(SUM(CASE WHEN p.points = 1 THEN 1 ELSE 0 END), 0) as correctResults,
        COUNT(DISTINCT CASE WHEN p.points IS NOT NULL THEN
          (SELECT md.gameweekId FROM matchday md
           JOIN match m ON m.matchdayId = md.id
           WHERE m.id = p.matchId)
        END) as gameweeksPlayed
      FROM league_member lm
      JOIN user u ON lm.userId = u.id
      LEFT JOIN team t ON u.favoriteTeamId = t.id
      LEFT JOIN prediction p ON p.userId = u.id AND p.leagueId = ?
      WHERE lm.leagueId = ?
      GROUP BY u.id
      ORDER BY totalPoints DESC, exactScores DESC, correctResults DESC
    `).all(leagueId, leagueId) as any[];

    // Add ranks (handle ties)
    const leaderboard: LeaderboardEntry[] = [];
    let currentRank = 1;
    let previousPoints = -1;
    let previousExact = -1;

    for (let i = 0; i < standings.length; i++) {
      const entry = standings[i];

      // Same rank for ties
      if (entry.totalPoints !== previousPoints || entry.exactScores !== previousExact) {
        currentRank = i + 1;
      }

      leaderboard.push({
        rank: currentRank,
        userId: entry.userId,
        username: entry.username,
        firstName: entry.firstName,
        lastName: entry.lastName,
        totalPoints: entry.totalPoints,
        exactScores: entry.exactScores,
        correctResults: entry.correctResults,
        gameweeksPlayed: entry.gameweeksPlayed,
        teamLogo: entry.teamLogo,
      });

      previousPoints = entry.totalPoints;
      previousExact = entry.exactScores;
    }

    res.json({
      entries: leaderboard,
      isSeasonComplete,
      champion: isSeasonComplete && leaderboard.length > 0 ? leaderboard[0] : null,
    });
  } catch (err) {
    console.error("Failed to fetch leaderboard:", err);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// Get user's rank in a league
router.get("/:leagueId/user/:userId", requireAuth, (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { leagueId, userId } = req.params;

  try {
    // Verify requesting user is member of league
    const member = db.prepare(`
      SELECT id FROM league_member WHERE leagueId = ? AND userId = ?
    `).get(leagueId, user.id);

    if (!member) {
      res.status(403).json({ error: "You are not a member of this league" });
      return;
    }

    // Get the specific user's stats
    const userStats = db.prepare(`
      SELECT
        u.id as userId,
        u.username,
        u.firstName,
        u.lastName,
        COALESCE(SUM(p.points), 0) as totalPoints,
        COALESCE(SUM(CASE WHEN p.points = 3 THEN 1 ELSE 0 END), 0) as exactScores,
        COALESCE(SUM(CASE WHEN p.points = 1 THEN 1 ELSE 0 END), 0) as correctResults
      FROM user u
      LEFT JOIN prediction p ON p.userId = u.id AND p.leagueId = ?
      WHERE u.id = ?
      GROUP BY u.id
    `).get(leagueId, userId) as any;

    if (!userStats) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Calculate rank
    const higherRanked = db.prepare(`
      SELECT COUNT(DISTINCT lm.userId) as count
      FROM league_member lm
      LEFT JOIN prediction p ON p.userId = lm.userId AND p.leagueId = ?
      WHERE lm.leagueId = ?
      GROUP BY lm.userId
      HAVING COALESCE(SUM(p.points), 0) > ?
         OR (COALESCE(SUM(p.points), 0) = ?
             AND COALESCE(SUM(CASE WHEN p.points = 3 THEN 1 ELSE 0 END), 0) > ?)
    `).all(leagueId, leagueId, userStats.totalPoints, userStats.totalPoints, userStats.exactScores) as any[];

    const rank = higherRanked.length + 1;

    // Get total members
    const totalMembers = db.prepare(`
      SELECT COUNT(*) as count FROM league_member WHERE leagueId = ?
    `).get(leagueId) as { count: number };

    res.json({
      rank,
      totalMembers: totalMembers.count,
      ...userStats,
    });
  } catch (err) {
    console.error("Failed to fetch user rank:", err);
    res.status(500).json({ error: "Failed to fetch user rank" });
  }
});

// Get gameweek leaderboard (points earned in a specific gameweek)
router.get("/:leagueId/gameweek/:gameweekId", requireAuth, (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { leagueId, gameweekId } = req.params;

  try {
    // Verify user is member of league
    const member = db.prepare(`
      SELECT id FROM league_member WHERE leagueId = ? AND userId = ?
    `).get(leagueId, user.id);

    if (!member) {
      res.status(403).json({ error: "You are not a member of this league" });
      return;
    }

    // Get gameweek scores
    const gameweekStandings = db.prepare(`
      SELECT
        u.id as userId,
        u.username,
        u.firstName,
        u.lastName,
        COALESCE(SUM(p.points), 0) as gameweekPoints,
        COALESCE(SUM(CASE WHEN p.points = 3 THEN 1 ELSE 0 END), 0) as exactScores,
        COALESCE(SUM(CASE WHEN p.points = 1 THEN 1 ELSE 0 END), 0) as correctResults,
        COUNT(p.id) as predictionsMade
      FROM league_member lm
      JOIN user u ON lm.userId = u.id
      LEFT JOIN prediction p ON p.userId = u.id AND p.leagueId = ?
      LEFT JOIN match m ON p.matchId = m.id
      LEFT JOIN matchday md ON m.matchdayId = md.id AND md.gameweekId = ?
      WHERE lm.leagueId = ?
      GROUP BY u.id
      ORDER BY gameweekPoints DESC, exactScores DESC
    `).all(leagueId, gameweekId, leagueId) as any[];

    // Add ranks
    const leaderboard = [];
    let currentRank = 1;
    let previousPoints = -1;

    for (let i = 0; i < gameweekStandings.length; i++) {
      const entry = gameweekStandings[i];

      if (entry.gameweekPoints !== previousPoints) {
        currentRank = i + 1;
      }

      leaderboard.push({
        rank: currentRank,
        userId: entry.userId,
        username: entry.username,
        firstName: entry.firstName,
        lastName: entry.lastName,
        gameweekPoints: entry.gameweekPoints,
        exactScores: entry.exactScores,
        correctResults: entry.correctResults,
        predictionsMade: entry.predictionsMade,
      });

      previousPoints = entry.gameweekPoints;
    }

    res.json(leaderboard);
  } catch (err) {
    console.error("Failed to fetch gameweek leaderboard:", err);
    res.status(500).json({ error: "Failed to fetch gameweek leaderboard" });
  }
});

export default router;
