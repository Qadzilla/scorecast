import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { League } from "@/types/leagues";

export const leagueKeys = {
  all: ["leagues"] as const,
};

// The user's leagues. memberCount arrives as a string (SQL COUNT) — coerce.
export function useLeagues() {
  return useQuery({
    queryKey: leagueKeys.all,
    queryFn: async () => {
      const rows = await apiFetch<(Omit<League, "memberCount"> & { memberCount: string | number })[]>(
        "/api/leagues"
      );
      return rows.map((r) => ({ ...r, memberCount: Number(r.memberCount) })) as League[];
    },
    staleTime: 60 * 1000,
  });
}

export function useJoinLeague() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteCode: string) =>
      apiFetch<League>("/api/leagues/join", {
        method: "POST",
        body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase() }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: leagueKeys.all }),
  });
}
