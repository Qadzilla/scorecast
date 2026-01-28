import { Router } from "express";
import { queryAll, queryOne, withTransaction } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import crypto from "crypto";
import {
  calculatePredictionPoints,
  validatePredictionScore,
} from "../types/predictions.js";

const router = Router();

// Get user's predictions for a gameweek in a league
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

    // Get predictions with match details
    const predictions = await queryAll<{
      id: string;
      matchId: string;
      predictedHome: number;
      predictedAway: number;
      points: number | null;
      createdAt: string;
      updatedAt: string;
      kickoffTime: string;
      actualHome: number | null;
      actualAway: number | null;
      matchStatus: string;
      venue: string | null;
      homeTeamId: string;
      homeTeamName: string;
      homeTeamShortName: string;
      homeTeamCode: string;
      awayTeamId: string;
      awayTeamName: string;
      awayTeamShortName: string;
      awayTeamCode: string;
    }>(
      `SELECT
        p.id,
        p."matchId",
        p."homeScore" as "predictedHome",
        p."awayScore" as "predictedAway",
        p.points,
        p."createdAt",
        p."updatedAt",
        m."kickoffTime",
        m."homeScore" as "actualHome",
        m."awayScore" as "actualAway",
        m.status as "matchStatus",
        m.venue,
        ht.id as "homeTeamId",
        ht.name as "homeTeamName",
        ht."shortName" as "homeTeamShortName",
        ht.code as "homeTeamCode",
        at.id as "awayTeamId",
        at.name as "awayTeamName",
        at."shortName" as "awayTeamShortName",
        at.code as "awayTeamCode"
      FROM prediction p
      JOIN match m ON p."matchId" = m.id
      JOIN matchday md ON m."matchdayId" = md.id
      JOIN team ht ON m."homeTeamId" = ht.id
      JOIN team at ON m."awayTeamId" = at.id
      WHERE p."userId" = $1 AND p."leagueId" = $2 AND md."gameweekId" = $3
      ORDER BY m."kickoffTime" ASC`,
      [user.id, leagueId, gameweekId]
    );

    // Transform to proper structure
    const formattedPredictions = predictions.map((p) => ({
      id: p.id,
      matchId: p.matchId,
      predictedHome: p.predictedHome,
      predictedAway: p.predictedAway,
      points: p.points,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      match: {
        id: p.matchId,
        kickoffTime: p.kickoffTime,
        homeScore: p.actualHome,
        awayScore: p.actualAway,
        status: p.matchStatus,
        venue: p.venue,
        homeTeam: {
          id: p.homeTeamId,
          name: p.homeTeamName,
          shortName: p.homeTeamShortName,
          code: p.homeTeamCode,
        },
        awayTeam: {
          id: p.awayTeamId,
          name: p.awayTeamName,
          shortName: p.awayTeamShortName,
          code: p.awayTeamCode,
        },
      },
    }));

    res.json(formattedPredictions);
  } catch (err) {
    console.error("Failed to fetch predictions:", err);
    res.status(500).json({ error: "Failed to fetch predictions" });
  }
});

// Submit/update predictions for a gameweek
router.post("/:leagueId/gameweek/:gameweekId", requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { leagueId, gameweekId } = req.params;
  const { predictions } = req.body;

  if (!Array.isArray(predictions) || predictions.length === 0) {
    res.status(400).json({ error: "Predictions array is required" });
    return;
  }

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

    // Get gameweek and check deadline
    const gameweek = await queryOne<{ id: string; deadline: string }>(
      `SELECT id, deadline FROM gameweek WHERE id = $1`,
      [gameweekId]
    );

    if (!gameweek) {
      res.status(404).json({ error: "Gameweek not found" });
      return;
    }

    if (new Date(gameweek.deadline) <= new Date()) {
      res.status(400).json({ error: "Prediction deadline has passed" });
      return;
    }

    // Validate predictions
    for (const pred of predictions) {
      if (!pred.matchId || !validatePredictionScore(pred.homeScore) || !validatePredictionScore(pred.awayScore)) {
        res.status(400).json({ error: "Invalid prediction data" });
        return;
      }
    }

    // Verify all matches belong to this gameweek
    const matchIds = predictions.map((p: any) => p.matchId);
    const placeholders = matchIds.map((_, i) => `$${i + 2}`).join(",");
    const validMatches = await queryAll<{ id: string }>(
      `SELECT m.id FROM match m
      JOIN matchday md ON m."matchdayId" = md.id
      WHERE md."gameweekId" = $1 AND m.id IN (${placeholders})`,
      [gameweekId, ...matchIds]
    );

    if (validMatches.length !== matchIds.length) {
      res.status(400).json({ error: "Some matches do not belong to this gameweek" });
      return;
    }

    const now = new Date().toISOString();

    // Upsert predictions in a transaction
    await withTransaction(async (client) => {
      for (const pred of predictions) {
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO prediction (id, "userId", "matchId", "leagueId", "homeScore", "awayScore", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT("userId", "matchId", "leagueId") DO UPDATE SET
            "homeScore" = EXCLUDED."homeScore",
            "awayScore" = EXCLUDED."awayScore",
            "updatedAt" = EXCLUDED."updatedAt"`,
          [id, user.id, pred.matchId, leagueId, pred.homeScore, pred.awayScore, now, now]
        );
      }
    });

    res.json({ success: true, message: "Predictions saved" });
  } catch (err) {
    console.error("Failed to save predictions:", err);
    res.status(500).json({ error: "Failed to save predictions" });
  }
});

// Score predictions for a match (called when match results are entered)
export async function scorePredictionsForMatch(matchId: string): Promise<void> {
  const match = await queryOne<{
    id: string;
    homeScore: number | null;
    awayScore: number | null;
    status: string;
  }>(
    `SELECT id, "homeScore", "awayScore", status FROM match WHERE id = $1`,
    [matchId]
  );

  if (!match || match.homeScore === null || match.awayScore === null || match.status !== "finished") {
    return;
  }

  const predictions = await queryAll<{
    id: string;
    homeScore: number;
    awayScore: number;
  }>(
    `SELECT id, "homeScore", "awayScore" FROM prediction WHERE "matchId" = $1`,
    [matchId]
  );

  const now = new Date().toISOString();

  await withTransaction(async (client) => {
    for (const pred of predictions) {
      const result = calculatePredictionPoints(
        pred.homeScore,
        pred.awayScore,
        match.homeScore!,
        match.awayScore!
      );
      await client.query(
        `UPDATE prediction SET points = $1, "updatedAt" = $2 WHERE id = $3`,
        [result.points, now, pred.id]
      );
    }
  });
}

export default router;
