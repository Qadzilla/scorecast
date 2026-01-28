import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import crypto from "crypto";
import {
  calculatePredictionPoints,
  validatePredictionScore,
} from "../types/predictions.js";

const router = Router();

// Get user's predictions for a gameweek in a league
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

    // Get predictions with match details
    const predictions = db.prepare(`
      SELECT
        p.id,
        p.matchId,
        p.homeScore as predictedHome,
        p.awayScore as predictedAway,
        p.points,
        p.createdAt,
        p.updatedAt,
        m.kickoffTime,
        m.homeScore as actualHome,
        m.awayScore as actualAway,
        m.status as matchStatus,
        m.venue,
        ht.id as homeTeamId,
        ht.name as homeTeamName,
        ht.shortName as homeTeamShortName,
        ht.code as homeTeamCode,
        at.id as awayTeamId,
        at.name as awayTeamName,
        at.shortName as awayTeamShortName,
        at.code as awayTeamCode
      FROM prediction p
      JOIN match m ON p.matchId = m.id
      JOIN matchday md ON m.matchdayId = md.id
      JOIN team ht ON m.homeTeamId = ht.id
      JOIN team at ON m.awayTeamId = at.id
      WHERE p.userId = ? AND p.leagueId = ? AND md.gameweekId = ?
      ORDER BY m.kickoffTime ASC
    `).all(user.id, leagueId, gameweekId);

    // Transform to proper structure
    const formattedPredictions = predictions.map((p: any) => ({
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
router.post("/:leagueId/gameweek/:gameweekId", requireAuth, (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { leagueId, gameweekId } = req.params;
  const { predictions } = req.body;

  if (!Array.isArray(predictions) || predictions.length === 0) {
    res.status(400).json({ error: "Predictions array is required" });
    return;
  }

  try {
    // Verify user is member of league
    const member = db.prepare(`
      SELECT id FROM league_member WHERE leagueId = ? AND userId = ?
    `).get(leagueId, user.id);

    if (!member) {
      res.status(403).json({ error: "You are not a member of this league" });
      return;
    }

    // Get gameweek and check deadline
    const gameweek = db.prepare(`
      SELECT id, deadline FROM gameweek WHERE id = ?
    `).get(gameweekId) as { id: string; deadline: string } | undefined;

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
    const placeholders = matchIds.map(() => "?").join(",");
    const validMatches = db.prepare(`
      SELECT m.id FROM match m
      JOIN matchday md ON m.matchdayId = md.id
      WHERE md.gameweekId = ? AND m.id IN (${placeholders})
    `).all(gameweekId, ...matchIds) as { id: string }[];

    if (validMatches.length !== matchIds.length) {
      res.status(400).json({ error: "Some matches do not belong to this gameweek" });
      return;
    }

    const now = new Date().toISOString();

    // Upsert predictions
    const upsertStmt = db.prepare(`
      INSERT INTO prediction (id, userId, matchId, leagueId, homeScore, awayScore, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(userId, matchId, leagueId) DO UPDATE SET
        homeScore = excluded.homeScore,
        awayScore = excluded.awayScore,
        updatedAt = excluded.updatedAt
    `);

    const transaction = db.transaction(() => {
      for (const pred of predictions) {
        const id = crypto.randomUUID();
        upsertStmt.run(id, user.id, pred.matchId, leagueId, pred.homeScore, pred.awayScore, now, now);
      }
    });

    transaction();

    res.json({ success: true, message: "Predictions saved" });
  } catch (err) {
    console.error("Failed to save predictions:", err);
    res.status(500).json({ error: "Failed to save predictions" });
  }
});

// Score predictions for a match (called when match results are entered)
export function scorePredictionsForMatch(matchId: string): void {
  const match = db.prepare(`
    SELECT id, homeScore, awayScore, status FROM match WHERE id = ?
  `).get(matchId) as { id: string; homeScore: number | null; awayScore: number | null; status: string } | undefined;

  if (!match || match.homeScore === null || match.awayScore === null || match.status !== "finished") {
    return;
  }

  const predictions = db.prepare(`
    SELECT id, homeScore, awayScore FROM prediction WHERE matchId = ?
  `).all(matchId) as { id: string; homeScore: number; awayScore: number }[];

  const updateStmt = db.prepare(`
    UPDATE prediction SET points = ?, updatedAt = ? WHERE id = ?
  `);

  const now = new Date().toISOString();

  const transaction = db.transaction(() => {
    for (const pred of predictions) {
      const result = calculatePredictionPoints(
        pred.homeScore,
        pred.awayScore,
        match.homeScore!,
        match.awayScore!
      );
      updateStmt.run(result.points, now, pred.id);
    }
  });

  transaction();
}

export default router;
