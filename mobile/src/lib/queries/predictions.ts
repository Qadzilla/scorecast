import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { UserPrediction } from "@/types/predictions";

export const predictionKeys = {
  byGameweek: (leagueId: string, gameweekId: string) =>
    ["predictions", leagueId, gameweekId] as const,
};

// The user's saved predictions for a gameweek in a league (with per-match
// points once scored). Empty array before they've predicted.
export function usePredictions(leagueId: string, gameweekId: string | undefined) {
  return useQuery({
    queryKey: predictionKeys.byGameweek(leagueId, gameweekId ?? "none"),
    queryFn: () => apiFetch<UserPrediction[]>(`/api/predictions/${leagueId}/gameweek/${gameweekId}`),
    enabled: !!gameweekId,
    staleTime: 60 * 1000,
  });
}

export interface PredictionInput {
  matchId: string;
  homeScore: number;
  awayScore: number;
}

// Upsert predictions. Server re-checks the deadline and returns 400 if passed —
// the screen surfaces that. Invalidates predictions + the league leaderboard.
export function useSubmitPredictions(leagueId: string, gameweekId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (predictions: PredictionInput[]) =>
      apiFetch<{ success: boolean; message: string }>(
        `/api/predictions/${leagueId}/gameweek/${gameweekId}`,
        { method: "POST", body: JSON.stringify({ predictions }) }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: predictionKeys.byGameweek(leagueId, gameweekId) });
      qc.invalidateQueries({ queryKey: ["leaderboard", leagueId] });
    },
  });
}
