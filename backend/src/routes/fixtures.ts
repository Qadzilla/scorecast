import { Router } from "express";
import { queryAll, queryOne } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Get current gameweek for a competition
router.get("/gameweek/current/:competition", requireAuth, async (req, res) => {
  const { competition } = req.params;

  if (competition !== "premier_league" && competition !== "champions_league") {
    res.status(400).json({ error: "Invalid competition type" });
    return;
  }

  try {
    // Get current season
    const season = await queryOne<{ id: string }>(
      `SELECT id FROM season WHERE competition = $1 AND "isCurrent" = true`,
      [competition]
    );

    if (!season) {
      res.status(404).json({ error: "No active season found" });
      return;
    }

    // Get the gameweek where predictions are still open (deadline not passed)
    // If no open deadline, get the currently active or most recent gameweek
    const now = new Date().toISOString();

    let gameweek = await queryOne<{
      id: string;
      seasonId: string;
      number: number;
      name: string;
      deadline: string;
      startsAt: string;
      endsAt: string;
      status: string;
    }>(
      `SELECT
        g.id,
        g."seasonId",
        g.number,
        g.name,
        g.deadline,
        g."startsAt",
        g."endsAt",
        g.status
      FROM gameweek g
      WHERE g."seasonId" = $1 AND g.deadline > $2
      ORDER BY g.number ASC
      LIMIT 1`,
      [season.id, now]
    );

    // If no gameweek with open deadline, get the active one
    if (!gameweek) {
      gameweek = await queryOne<{
        id: string;
        seasonId: string;
        number: number;
        name: string;
        deadline: string;
        startsAt: string;
        endsAt: string;
        status: string;
      }>(
        `SELECT
          g.id,
          g."seasonId",
          g.number,
          g.name,
          g.deadline,
          g."startsAt",
          g."endsAt",
          g.status
        FROM gameweek g
        WHERE g."seasonId" = $1 AND g.status = 'active'
        ORDER BY g.number DESC
        LIMIT 1`,
        [season.id]
      );
    }

    if (!gameweek) {
      res.status(404).json({ error: "No upcoming gameweek found" });
      return;
    }

    res.json(gameweek);
  } catch (err) {
    console.error("Failed to fetch current gameweek:", err);
    res.status(500).json({ error: "Failed to fetch current gameweek" });
  }
});

// Get gameweek by ID with matches
router.get("/gameweek/:gameweekId", requireAuth, async (req, res) => {
  const { gameweekId } = req.params;

  try {
    const gameweek = await queryOne<{
      id: string;
      seasonId: string;
      number: number;
      name: string;
      deadline: string;
      startsAt: string;
      endsAt: string;
      status: string;
      seasonName: string;
      competition: string;
    }>(
      `SELECT
        g.id,
        g."seasonId",
        g.number,
        g.name,
        g.deadline,
        g."startsAt",
        g."endsAt",
        g.status,
        s.name as "seasonName",
        s.competition
      FROM gameweek g
      JOIN season s ON g."seasonId" = s.id
      WHERE g.id = $1`,
      [gameweekId]
    );

    if (!gameweek) {
      res.status(404).json({ error: "Gameweek not found" });
      return;
    }

    // Get matchdays and matches
    const matchdays = await queryAll<{
      id: string;
      date: string;
      dayNumber: number;
    }>(
      `SELECT
        md.id,
        md.date,
        md."dayNumber"
      FROM matchday md
      WHERE md."gameweekId" = $1
      ORDER BY md."dayNumber" ASC`,
      [gameweekId]
    );

    const matchdaysWithMatches = await Promise.all(matchdays.map(async (md) => {
      const matches = await queryAll<{
        id: string;
        kickoffTime: string;
        homeScore: number | null;
        awayScore: number | null;
        status: string;
        venue: string | null;
        homeTeamId: string;
        homeTeamName: string;
        homeTeamShortName: string;
        homeTeamCode: string;
        homeTeamLogo: string | null;
        awayTeamId: string;
        awayTeamName: string;
        awayTeamShortName: string;
        awayTeamCode: string;
        awayTeamLogo: string | null;
      }>(
        `SELECT
          m.id,
          m."kickoffTime",
          m."homeScore",
          m."awayScore",
          m.status,
          m.venue,
          ht.id as "homeTeamId",
          ht.name as "homeTeamName",
          ht."shortName" as "homeTeamShortName",
          ht.code as "homeTeamCode",
          ht.logo as "homeTeamLogo",
          at.id as "awayTeamId",
          at.name as "awayTeamName",
          at."shortName" as "awayTeamShortName",
          at.code as "awayTeamCode",
          at.logo as "awayTeamLogo"
        FROM match m
        JOIN team ht ON m."homeTeamId" = ht.id
        JOIN team at ON m."awayTeamId" = at.id
        WHERE m."matchdayId" = $1
        ORDER BY m."kickoffTime" ASC`,
        [md.id]
      );

      return {
        ...md,
        matches: matches.map((m) => ({
          id: m.id,
          kickoffTime: m.kickoffTime,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          status: m.status,
          venue: m.venue,
          homeTeam: {
            id: m.homeTeamId,
            name: m.homeTeamName,
            shortName: m.homeTeamShortName,
            code: m.homeTeamCode,
            logo: m.homeTeamLogo,
          },
          awayTeam: {
            id: m.awayTeamId,
            name: m.awayTeamName,
            shortName: m.awayTeamShortName,
            code: m.awayTeamCode,
            logo: m.awayTeamLogo,
          },
        })),
      };
    }));

    res.json({
      ...gameweek,
      matchdays: matchdaysWithMatches,
    });
  } catch (err) {
    console.error("Failed to fetch gameweek:", err);
    res.status(500).json({ error: "Failed to fetch gameweek" });
  }
});

// Get all gameweeks for a season
router.get("/season/:seasonId/gameweeks", requireAuth, async (req, res) => {
  const { seasonId } = req.params;

  try {
    const gameweeks = await queryAll(
      `SELECT
        g.id,
        g.number,
        g.name,
        g.deadline,
        g."startsAt",
        g."endsAt",
        g.status,
        (SELECT COUNT(*) FROM matchday md
         JOIN match m ON m."matchdayId" = md.id
         WHERE md."gameweekId" = g.id) as "matchCount"
      FROM gameweek g
      WHERE g."seasonId" = $1
      ORDER BY g.number ASC`,
      [seasonId]
    );

    res.json(gameweeks);
  } catch (err) {
    console.error("Failed to fetch gameweeks:", err);
    res.status(500).json({ error: "Failed to fetch gameweeks" });
  }
});

// Get current season for a competition
router.get("/season/current/:competition", requireAuth, async (req, res) => {
  const { competition } = req.params;

  if (competition !== "premier_league" && competition !== "champions_league") {
    res.status(400).json({ error: "Invalid competition type" });
    return;
  }

  try {
    const season = await queryOne(
      `SELECT id, name, competition, "startDate", "endDate", "isCurrent"
      FROM season WHERE competition = $1 AND "isCurrent" = true`,
      [competition]
    );

    if (!season) {
      res.status(404).json({ error: "No active season found" });
      return;
    }

    res.json(season);
  } catch (err) {
    console.error("Failed to fetch current season:", err);
    res.status(500).json({ error: "Failed to fetch current season" });
  }
});

// Get season status (including completion info)
router.get("/season/:competition/status", requireAuth, async (req, res) => {
  const { competition } = req.params;

  if (competition !== "premier_league" && competition !== "champions_league") {
    res.status(400).json({ error: "Invalid competition type" });
    return;
  }

  try {
    // Get current season
    const season = await queryOne<{
      id: string;
      name: string;
      competition: string;
      startDate: string;
      endDate: string;
      isCurrent: boolean;
    }>(
      `SELECT id, name, competition, "startDate", "endDate", "isCurrent"
      FROM season WHERE competition = $1 AND "isCurrent" = true`,
      [competition]
    );

    if (!season) {
      res.status(404).json({ error: "No active season found" });
      return;
    }

    // Count total gameweeks and completed gameweeks
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
    const isSeasonComplete = total > 0 && total === completed;

    res.json({
      ...season,
      totalGameweeks: total,
      completedGameweeks: completed,
      isSeasonComplete,
    });
  } catch (err) {
    console.error("Failed to fetch season status:", err);
    res.status(500).json({ error: "Failed to fetch season status" });
  }
});

// Get all teams for a competition
router.get("/teams/:competition", requireAuth, async (req, res) => {
  const { competition } = req.params;

  if (competition !== "premier_league" && competition !== "champions_league") {
    res.status(400).json({ error: "Invalid competition type" });
    return;
  }

  try {
    const teams = await queryAll(
      `SELECT id, name, "shortName", code, logo, competition
      FROM team WHERE competition = $1
      ORDER BY name ASC`,
      [competition]
    );

    res.json(teams);
  } catch (err) {
    console.error("Failed to fetch teams:", err);
    res.status(500).json({ error: "Failed to fetch teams" });
  }
});

export default router;
