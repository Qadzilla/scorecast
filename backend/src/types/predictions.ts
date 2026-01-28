import type { Match, MatchWithTeams } from "./fixtures.js";

// Points awarded for predictions
export const POINTS = {
  EXACT_SCORE: 3,   // Predicted exact score (e.g., 2-1 and result was 2-1)
  CORRECT_RESULT: 1, // Predicted correct result (win/draw/loss) but wrong score
  INCORRECT: 0,      // Got nothing right
} as const;

// Match result type
export type MatchResult = "home_win" | "away_win" | "draw";

// Prediction for a single match
export interface Prediction {
  id: string;
  userId: string;
  matchId: string;
  leagueId: string; // The prediction league this prediction belongs to
  homeScore: number;
  awayScore: number;
  points: number | null; // null until match is finished and scored
  createdAt: string;
  updatedAt: string;
}

// Prediction with match details (for API responses)
export interface PredictionWithMatch extends Prediction {
  match: MatchWithTeams;
}

// Gameweek predictions - all predictions for a user in a gameweek
export interface GameweekPredictions {
  gameweekId: string;
  userId: string;
  leagueId: string;
  predictions: PredictionWithMatch[];
  totalPoints: number | null; // null if gameweek not yet scored
  submittedAt: string | null; // when predictions were last submitted
}

// Prediction input (for creating/updating predictions)
export interface PredictionInput {
  matchId: string;
  homeScore: number;
  awayScore: number;
}

// Batch prediction input (for submitting all gameweek predictions at once)
export interface GameweekPredictionInput {
  gameweekId: string;
  leagueId: string;
  predictions: PredictionInput[];
}

// User's gameweek summary (for leaderboards)
export interface UserGameweekScore {
  userId: string;
  username: string;
  gameweekId: string;
  leagueId: string;
  totalPoints: number;
  exactScores: number; // count of exact score predictions
  correctResults: number; // count of correct result predictions
  rank: number;
}

// User's overall league standing
export interface LeagueStanding {
  userId: string;
  username: string;
  firstName?: string;
  lastName?: string;
  leagueId: string;
  totalPoints: number;
  gameweeksPlayed: number;
  exactScores: number;
  correctResults: number;
  rank: number;
  previousRank?: number; // for showing movement
}

// Helper: Get result from scores
export function getMatchResult(homeScore: number, awayScore: number): MatchResult {
  if (homeScore > awayScore) return "home_win";
  if (awayScore > homeScore) return "away_win";
  return "draw";
}

// Helper: Calculate points for a prediction
export function calculatePredictionPoints(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number
): { points: number; type: "exact" | "result" | "incorrect" } {
  // Exact score match
  if (predictedHome === actualHome && predictedAway === actualAway) {
    return { points: POINTS.EXACT_SCORE, type: "exact" };
  }

  // Check if result matches (win/draw/loss)
  const predictedResult = getMatchResult(predictedHome, predictedAway);
  const actualResult = getMatchResult(actualHome, actualAway);

  if (predictedResult === actualResult) {
    return { points: POINTS.CORRECT_RESULT, type: "result" };
  }

  // Nothing correct
  return { points: POINTS.INCORRECT, type: "incorrect" };
}

// Helper: Calculate total points for a set of predictions
export function calculateGameweekPoints(
  predictions: Array<{
    predictedHome: number;
    predictedAway: number;
    actualHome: number | null;
    actualAway: number | null;
  }>
): {
  totalPoints: number;
  exactScores: number;
  correctResults: number;
  scoredCount: number;
} {
  let totalPoints = 0;
  let exactScores = 0;
  let correctResults = 0;
  let scoredCount = 0;

  for (const pred of predictions) {
    // Skip if match not finished
    if (pred.actualHome === null || pred.actualAway === null) {
      continue;
    }

    scoredCount++;
    const result = calculatePredictionPoints(
      pred.predictedHome,
      pred.predictedAway,
      pred.actualHome,
      pred.actualAway
    );

    totalPoints += result.points;
    if (result.type === "exact") exactScores++;
    if (result.type === "result") correctResults++;
  }

  return { totalPoints, exactScores, correctResults, scoredCount };
}

// Validate prediction scores (must be non-negative integers)
export function validatePredictionScore(score: unknown): score is number {
  return (
    typeof score === "number" &&
    Number.isInteger(score) &&
    score >= 0 &&
    score <= 99 // reasonable max
  );
}
