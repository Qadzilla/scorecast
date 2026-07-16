import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { CompetitionType } from "@/types/fixtures";
import type { CurrentGameweek, GameweekDetail } from "@/types/leagues";

export const fixtureKeys = {
  currentGameweek: (competition: CompetitionType) => ["gameweek", "current", competition] as const,
  gameweek: (gameweekId: string) => ["gameweek", gameweekId] as const,
};

// Current gameweek + next-deadline for a competition. Public endpoint (no auth
// needed). Fixtures sync every 15 min, so a 5 min staleTime is plenty.
export function useCurrentGameweek(competition: CompetitionType) {
  return useQuery({
    queryKey: fixtureKeys.currentGameweek(competition),
    queryFn: () => apiFetch<CurrentGameweek>(`/api/fixtures/gameweek/current/${competition}`),
    staleTime: 5 * 60 * 1000,
  });
}

// Full gameweek (matchdays + matches) for the Fixtures pane. Public endpoint.
export function useGameweek(gameweekId: string | undefined) {
  return useQuery({
    queryKey: fixtureKeys.gameweek(gameweekId ?? "none"),
    queryFn: () => apiFetch<GameweekDetail>(`/api/fixtures/gameweek/${gameweekId}`),
    enabled: !!gameweekId,
    staleTime: 5 * 60 * 1000,
  });
}
