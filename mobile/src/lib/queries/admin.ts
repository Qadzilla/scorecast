import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface AdminUser {
  id: string;
  username: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  hasPendingGrant: boolean;
}

export interface AdminGrant {
  id: string;
  userId: string;
  used: boolean;
  usedLeagueId: string | null;
  createdAt: string;
  usedAt: string | null;
  username: string | null;
  email: string;
  leagueName: string | null;
}

export interface AdminLeague {
  id: string;
  name: string;
  type: string;
  inviteCode: string;
  createdBy: string | null;
  createdAt: string;
  creatorUsername: string | null;
  creatorEmail: string | null;
  memberCount: number;
}

export const adminKeys = {
  users: (q: string) => ["admin-users", q] as const,
  grants: ["admin-grants"] as const,
  leagues: ["admin-leagues"] as const,
};

// User search for granting (min 2 chars; admin-only server-side).
export function useAdminUsers(q: string) {
  return useQuery({
    queryKey: adminKeys.users(q),
    queryFn: () => apiFetch<AdminUser[]>(`/api/admin/users?q=${encodeURIComponent(q.trim())}`),
    enabled: q.trim().length >= 2,
    staleTime: 15 * 1000,
  });
}

export function useAdminGrants() {
  return useQuery({
    queryKey: adminKeys.grants,
    queryFn: () => apiFetch<AdminGrant[]>(`/api/admin/grants`),
    staleTime: 15 * 1000,
  });
}

export function useGrantLeagueCreation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<{ success: boolean; id: string }>(`/api/admin/grants`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.grants });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}

export function useRevokeGrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (grantId: string) =>
      apiFetch<{ success: boolean }>(`/api/admin/grants/${grantId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.grants });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}

// Every league (admin overview). memberCount arrives as a SQL COUNT string.
export function useAdminLeagues() {
  return useQuery({
    queryKey: adminKeys.leagues,
    queryFn: async () => {
      const rows = await apiFetch<(Omit<AdminLeague, "memberCount"> & { memberCount: string | number })[]>(
        "/api/admin/leagues"
      );
      return rows.map((r) => ({ ...r, memberCount: Number(r.memberCount) })) as AdminLeague[];
    },
    staleTime: 15 * 1000,
  });
}

export function useDeleteLeagueAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leagueId: string) =>
      apiFetch<{ success: boolean }>(`/api/admin/leagues/${leagueId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.leagues });
      qc.invalidateQueries({ queryKey: ["leagues"] });
    },
  });
}
