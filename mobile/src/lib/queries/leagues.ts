import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { CompetitionType } from "@/types/fixtures";
import type { League } from "@/types/leagues";

export const leagueKeys = {
  all: ["leagues"] as const,
  members: (leagueId: string) => ["league-members", leagueId] as const,
};

export interface LeagueMember {
  id: string;
  userId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: "admin" | "member";
  joinedAt: string;
}

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

// Admin-only (server enforces via ADMIN_EMAILS). Returns the flat league object.
export function useCreateLeague() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; type: CompetitionType }) =>
      apiFetch<League>("/api/leagues", {
        method: "POST",
        body: JSON.stringify({ name: input.name.trim(), type: input.type }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: leagueKeys.all }),
  });
}

export function useUpdateLeague(leagueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<{ success: boolean; name: string }>(`/api/leagues/${leagueId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim() }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: leagueKeys.all }),
  });
}

// Admin-only league roster.
export function useLeagueMembers(leagueId: string, enabled = true) {
  return useQuery({
    queryKey: leagueKeys.members(leagueId),
    queryFn: () => apiFetch<LeagueMember[]>(`/api/leagues/${leagueId}/members`),
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useKickMember(leagueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<{ success: boolean }>(`/api/leagues/${leagueId}/members/${userId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leagueKeys.members(leagueId) });
      qc.invalidateQueries({ queryKey: leagueKeys.all });
    },
  });
}
