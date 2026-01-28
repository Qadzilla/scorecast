import { Router } from "express";
import { queryAll, queryOne } from "../db.js";
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
router.get("/:leagueId", requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { leagueId } = req.params;

  try {
    // Verify user is member of league
    const member = await queryOne(
      `SELECT id FROM league_member WHERE "leagueId" = $1 AND "userId" = $2`,
      [leagueId, user.id]
    );

    if (!member) {
      res.status(403).json({ error: "You are not a member of this league" });
      return;
    }

    // Get league type to check season status
    const league = await queryOne<{ type: string }>(
      `SELECT type FROM league WHERE id = $1`,
      [leagueId]
    );

    // Check if season is complete
    let isSeasonComplete = false;
    if (league) {
      const season = await queryOne<{ id: string }>(
        `SELECT id FROM season WHERE competition = $1 AND "isCurrent" = true`,
        [league.type]
      );

      if (season) {
        const gameweekStats = await queryOne<{ total: string; completed: string }>(
          `SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
          FROM gameweek
          WHERE "seasonId" = $1`,
          [season.id]
        );

        const total = parseInt(gameweekStats?.total ?? "0", 10);
        const completed = parseInt(gameweekStats?.completed ?? "0", 10);
        isSeasonComplete = total > 0 && total === completed;
      }
    }

    // Get all members with their total points
    const standings = await queryAll<{
      userId: string;
      username: string;
      firstName: string | null;
      lastName: string | null;
      teamLogo: string | null;
      totalPoints: string;
      exactScores: string;
      correctResults: string;
      gameweeksPlayed: string;
    }>(
      `SELECT
        u.id as "userId",
        u.username,
        u."firstName",
        u."lastName",
        t.logo as "teamLogo",
        COALESCE(SUM(p.points), 0) as "totalPoints",
        COALESCE(SUM(CASE WHEN p.points = 3 THEN 1 ELSE 0 END), 0) as "exactScores",
        COALESCE(SUM(CASE WHEN p.points = 1 THEN 1 ELSE 0 END), 0) as "correctResults",
        COUNT(DISTINCT CASE WHEN p.points IS NOT NULL THEN
          (SELECT md."gameweekId" FROM matchday md
           JOIN match m ON m."matchdayId" = md.id
           WHERE m.id = p."matchId")
        END) as "gameweeksPlayed"
      FROM league_member lm
      JOIN "user" u ON lm."userId" = u.id
      LEFT JOIN team t ON u."favoriteTeamId" = t.id
      LEFT JOIN prediction p ON p."userId" = u.id AND p."leagueId" = $1
      WHERE lm."leagueId" = $2
      GROUP BY u.id, t.logo
      ORDER BY "totalPoints" DESC, "exactScores" DESC, "correctResults" DESC`,
      [leagueId, leagueId]
    );

    // Add ranks (handle ties)
    const leaderboard: LeaderboardEntry[] = [];
    let currentRank = 1;
    let previousPoints = -1;
    let previousExact = -1;

    for (let i = 0; i < standings.length; i++) {
      const entry = standings[i]!;
      const totalPoints = parseInt(entry.totalPoints, 10);
      const exactScores = parseInt(entry.exactScores, 10);

      // Same rank for ties
      if (totalPoints !== previousPoints || exactScores !== previousExact) {
        currentRank = i + 1;
      }

      leaderboard.push({
        rank: currentRank,
        userId: entry.userId,
        username: entry.username,
        firstName: entry.firstName,
        lastName: entry.lastName,
        totalPoints,
        exactScores,
        correctResults: parseInt(entry.correctResults, 10),
        gameweeksPlayed: parseInt(entry.gameweeksPlayed, 10),
        teamLogo: entry.teamLogo,
      });

      previousPoints = totalPoints;
      previousExact = exactScores;
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
router.get("/:leagueId/user/:userId", requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { leagueId, userId } = req.params;

  try {
    // Verify requesting user is member of league
    const member = await queryOne(
      `SELECT id FROM league_member WHERE "leagueId" = $1 AND "userId" = $2`,
      [leagueId, user.id]
    );

    if (!member) {
      res.status(403).json({ error: "You are not a member of this league" });
      return;
    }

    // Get the specific user's stats
    const userStats = await queryOne<{
      userId: string;
      username: string;
      firstName: string | null;
      lastName: string | null;
      totalPoints: string;
      exactScores: string;
      correctResults: string;
    }>(
      `SELECT
        u.id as "userId",
        u.username,
        u."firstName",
        u."lastName",
        COALESCE(SUM(p.points), 0) as "totalPoints",
        COALESCE(SUM(CASE WHEN p.points = 3 THEN 1 ELSE 0 END), 0) as "exactScores",
        COALESCE(SUM(CASE WHEN p.points = 1 THEN 1 ELSE 0 END), 0) as "correctResults"
      FROM "user" u
      LEFT JOIN prediction p ON p."userId" = u.id AND p."leagueId" = $1
      WHERE u.id = $2
      GROUP BY u.id`,
      [leagueId, userId]
    );

    if (!userStats) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const totalPoints = parseInt(userStats.totalPoints, 10);
    const exactScores = parseInt(userStats.exactScores, 10);

    // Calculate rank
    const higherRanked = await queryAll<{ count: string }>(
      `SELECT COUNT(DISTINCT lm."userId") as count
      FROM league_member lm
      LEFT JOIN prediction p ON p."userId" = lm."userId" AND p."leagueId" = $1
      WHERE lm."leagueId" = $2
      GROUP BY lm."userId"
      HAVING COALESCE(SUM(p.points), 0) > $3
         OR (COALESCE(SUM(p.points), 0) = $4
             AND COALESCE(SUM(CASE WHEN p.points = 3 THEN 1 ELSE 0 END), 0) > $5)`,
      [leagueId, leagueId, totalPoints, totalPoints, exactScores]
    );

    const rank = higherRanked.length + 1;

    // Get total members
    const totalMembers = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM league_member WHERE "leagueId" = $1`,
      [leagueId]
    );

    res.json({
      rank,
      totalMembers: parseInt(totalMembers?.count ?? "0", 10),
      userId: userStats.userId,
      username: userStats.username,
      firstName: userStats.firstName,
      lastName: userStats.lastName,
      totalPoints,
      exactScores,
      correctResults: parseInt(userStats.correctResults, 10),
    });
  } catch (err) {
    console.error("Failed to fetch user rank:", err);
    res.status(500).json({ error: "Failed to fetch user rank" });
  }
});

// Get gameweek leaderboard (points earned in a specific gameweek)
router.get("/:leagueId/gameweek/:gameweekId", requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { leagueId, gameweekId } = req.params;

  try {
    // Verify user is member of league
    const member = await queryOne(
      `SELECT id FROM league_member WHERE "leagueId" = $1 AND "userId" = $2`,
      [leagueId, user.id]
    );

    if (!member) {
      res.status(403).json({ error: "You are not a member of this league" });
      return;
    }

    // Get gameweek scores
    const gameweekStandings = await queryAll<{
      userId: string;
      username: string;
      firstName: string | null;
      lastName: string | null;
      gameweekPoints: string;
      exactScores: string;
      correctResults: string;
      predictionsMade: string;
    }>(
      `SELECT
        u.id as "userId",
        u.username,
        u."firstName",
        u."lastName",
        COALESCE(SUM(p.points), 0) as "gameweekPoints",
        COALESCE(SUM(CASE WHEN p.points = 3 THEN 1 ELSE 0 END), 0) as "exactScores",
        COALESCE(SUM(CASE WHEN p.points = 1 THEN 1 ELSE 0 END), 0) as "correctResults",
        COUNT(p.id) as "predictionsMade"
      FROM league_member lm
      JOIN "user" u ON lm."userId" = u.id
      LEFT JOIN prediction p ON p."userId" = u.id AND p."leagueId" = $1
      LEFT JOIN match m ON p."matchId" = m.id
      LEFT JOIN matchday md ON m."matchdayId" = md.id AND md."gameweekId" = $2
      WHERE lm."leagueId" = $3
      GROUP BY u.id
      ORDER BY "gameweekPoints" DESC, "exactScores" DESC`,
      [leagueId, gameweekId, leagueId]
    );

    // Add ranks
    const leaderboard = [];
    let currentRank = 1;
    let previousPoints = -1;

    for (let i = 0; i < gameweekStandings.length; i++) {
      const entry = gameweekStandings[i]!;
      const gameweekPoints = parseInt(entry.gameweekPoints, 10);

      if (gameweekPoints !== previousPoints) {
        currentRank = i + 1;
      }

      leaderboard.push({
        rank: currentRank,
        userId: entry.userId,
        username: entry.username,
        firstName: entry.firstName,
        lastName: entry.lastName,
        gameweekPoints,
        exactScores: parseInt(entry.exactScores, 10),
        correctResults: parseInt(entry.correctResults, 10),
        predictionsMade: parseInt(entry.predictionsMade, 10),
      });

      previousPoints = gameweekPoints;
    }

    res.json(leaderboard);
  } catch (err) {
    console.error("Failed to fetch gameweek leaderboard:", err);
    res.status(500).json({ error: "Failed to fetch gameweek leaderboard" });
  }
});

export default router;
