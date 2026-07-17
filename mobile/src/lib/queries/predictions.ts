import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
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

export interface PlayerPredictions {
  predictions: UserPrediction[];
  // True when picks were hidden from this viewer (predicted-but-hidden) — lets
  // the UI say "hid their picks" vs "hasn't predicted" when the list is empty.
  hasHidden: boolean;
}

// Another player's predictions for a gameweek. The server filters out any picks
// they hid until the deadline passes (per pick), so `predictions` may be shorter
// than what they made — or empty. `hasHidden` distinguishes hidden from none.
export function usePlayerPredictions(leagueId: string, gameweekId: string | undefined, userId: string) {
  return useQuery({
    queryKey: ["player-predictions", leagueId, gameweekId ?? "none", userId],
    queryFn: () =>
      apiFetch<PlayerPredictions>(`/api/predictions/${leagueId}/gameweek/${gameweekId}/user/${userId}`),
    enabled: !!gameweekId,
    retry: false,
    staleTime: 60 * 1000,
  });
}

// Across a set of leagues, how many has the user predicted for this gameweek
// (UXR4 "This week" status). One query per league via useQueries, sharing the
// same cache keys as usePredictions — so visiting a league doesn't refetch.
export function useGameweekPredictionStatus(leagueIds: string[], gameweekId: string | undefined) {
  const results = useQueries({
    queries: leagueIds.map((id) => ({
      queryKey: predictionKeys.byGameweek(id, gameweekId ?? "none"),
      queryFn: () => apiFetch<UserPrediction[]>(`/api/predictions/${id}/gameweek/${gameweekId}`),
      enabled: !!gameweekId,
      staleTime: 60 * 1000,
    })),
  });
  const predictedByLeague: Record<string, boolean> = {};
  leagueIds.forEach((id, i) => {
    predictedByLeague[id] = (results[i]?.data?.length ?? 0) > 0;
  });
  return {
    total: leagueIds.length,
    predicted: results.filter((r) => (r.data?.length ?? 0) > 0).length,
    isLoading: results.some((r) => r.isLoading),
    predictedByLeague,
  };
}

export interface PredictionInput {
  matchId: string;
  homeScore: number;
  awayScore: number;
}

// Upsert predictions. `hidden` rides on the whole submission (the predict-screen
// slider) — it keeps these picks hidden from other members until the deadline.
// Server re-checks the deadline and returns 400 if passed — the screen surfaces
// that. Invalidates predictions + the league leaderboard.
export function useSubmitPredictions(leagueId: string, gameweekId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { predictions: PredictionInput[]; hidden: boolean }) =>
      apiFetch<{ success: boolean; message: string }>(
        `/api/predictions/${leagueId}/gameweek/${gameweekId}`,
        { method: "POST", body: JSON.stringify({ predictions: input.predictions, hidden: input.hidden }) }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: predictionKeys.byGameweek(leagueId, gameweekId) });
      qc.invalidateQueries({ queryKey: ["leaderboard", leagueId] });
    },
  });
}
