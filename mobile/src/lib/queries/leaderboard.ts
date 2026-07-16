import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Leaderboard } from "@/types/leagues";

export const leaderboardKeys = {
  byLeague: (leagueId: string) => ["leaderboard", leagueId] as const,
};

// Full standings for a league. Used by the Leagues home (to pull the user's own
// standing per league) and the league detail Table pane. 1 min staleTime —
// results are scored on the 15 min cron but users refresh often near deadlines.
export function useLeaderboard(leagueId: string, enabled = true) {
  return useQuery({
    queryKey: leaderboardKeys.byLeague(leagueId),
    queryFn: () => apiFetch<Leaderboard>(`/api/leaderboard/${leagueId}`),
    enabled,
    staleTime: 60 * 1000,
  });
}
