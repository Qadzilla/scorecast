import type { MatchWithTeams } from "./fixtures";

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
  leagueId: string;
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
  totalPoints: number | null;
  submittedAt: string | null;
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
  exactScores: number;
  correctResults: number;
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
  previousRank?: number;
}

// Helper: Get result from scores
export function getMatchResult(homeScore: number, awayScore: number): MatchResult {
  if (homeScore > awayScore) return "home_win";
  if (awayScore > homeScore) return "away_win";
  return "draw";
}

// Helper: Calculate points for a prediction (client-side preview)
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

  // Check if result matches
  const predictedResult = getMatchResult(predictedHome, predictedAway);
  const actualResult = getMatchResult(actualHome, actualAway);

  if (predictedResult === actualResult) {
    return { points: POINTS.CORRECT_RESULT, type: "result" };
  }

  return { points: POINTS.INCORRECT, type: "incorrect" };
}

// Helper: Get points badge color based on result
export function getPointsBadgeColor(type: "exact" | "result" | "incorrect"): string {
  switch (type) {
    case "exact":
      return "bg-[#00ff87] text-gray-900"; // Green for exact
    case "result":
      return "bg-yellow-400 text-gray-900"; // Yellow for correct result
    case "incorrect":
      return "bg-red-500 text-white"; // Red for incorrect
  }
}

// Helper: Format rank with suffix (1st, 2nd, 3rd, etc.)
export function formatRank(rank: number): string {
  const suffix = ["th", "st", "nd", "rd"];
  const v = rank % 100;
  return rank + (suffix[(v - 20) % 10] || suffix[v] || suffix[0]);
}

// Helper: Get rank change indicator
export function getRankChange(current: number, previous?: number): {
  direction: "up" | "down" | "same";
  change: number;
} {
  if (previous === undefined || previous === current) {
    return { direction: "same", change: 0 };
  }
  if (current < previous) {
    return { direction: "up", change: previous - current };
  }
  return { direction: "down", change: current - previous };
}
