import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Team } from "@/types/fixtures";

// Query keys — one place so invalidations stay consistent.
export const userKeys = {
  me: ["me"] as const,
  favoriteTeam: ["favorite-team"] as const,
  teams: ["teams"] as const,
};

export interface Me {
  id: string;
  email: string;
  name: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  emailVerified: boolean;
  favoriteTeamId: string | null;
  isAdmin: boolean;
}

// Current user's profile + server-computed isAdmin. Admin UI (create league,
// manage members) gates on this — never on a client-baked email constant.
export function useMe() {
  return useQuery({
    queryKey: userKeys.me,
    queryFn: () => apiFetch<Me>("/api/user/me"),
    staleTime: 5 * 60 * 1000,
  });
}

type FavoriteTeamResponse = { favoriteTeamId: string | null; team: Team | null };

// Current user's favorite team (null until onboarding sets it). Drives the
// team-select gate. `enabled` lets the root layout fetch it only when signed in.
export function useFavoriteTeam(enabled = true) {
  return useQuery({
    queryKey: userKeys.favoriteTeam,
    queryFn: () => apiFetch<FavoriteTeamResponse>("/api/user/favorite-team"),
    enabled,
    staleTime: 60_000,
  });
}

// All selectable teams (deduplicated server-side, PL preferred over UCL).
export function useTeams() {
  return useQuery({
    queryKey: userKeys.teams,
    queryFn: () => apiFetch<Team[]>("/api/user/teams"),
    staleTime: 24 * 60 * 60 * 1000, // teams rarely change
  });
}

export function useSetFavoriteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) =>
      apiFetch<{ success: boolean; team: Team }>("/api/user/favorite-team", {
        method: "POST",
        body: JSON.stringify({ teamId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.favoriteTeam });
    },
  });
}
