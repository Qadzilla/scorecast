// Ported from the web app (frontend/src/types/predictions.ts). The Tailwind-
// specific getPointsBadgeColor is intentionally omitted — PointsBadge derives
// its colors from design tokens instead. Everything else is verbatim.

export const POINTS = {
  EXACT_SCORE: 3,
  CORRECT_RESULT: 1,
  INCORRECT: 0,
} as const;

export type MatchResult = "home_win" | "away_win" | "draw";
export type PredictionOutcome = "exact" | "result" | "incorrect";

export function getMatchResult(homeScore: number, awayScore: number): MatchResult {
  if (homeScore > awayScore) return "home_win";
  if (awayScore > homeScore) return "away_win";
  return "draw";
}

export function calculatePredictionPoints(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number
): { points: number; type: PredictionOutcome } {
  if (predictedHome === actualHome && predictedAway === actualAway) {
    return { points: POINTS.EXACT_SCORE, type: "exact" };
  }
  const predictedResult = getMatchResult(predictedHome, predictedAway);
  const actualResult = getMatchResult(actualHome, actualAway);
  if (predictedResult === actualResult) {
    return { points: POINTS.CORRECT_RESULT, type: "result" };
  }
  return { points: POINTS.INCORRECT, type: "incorrect" };
}

export function formatRank(rank: number): string {
  const suffix = ["th", "st", "nd", "rd"];
  const v = rank % 100;
  return rank + (suffix[(v - 20) % 10] || suffix[v] || suffix[0]);
}
