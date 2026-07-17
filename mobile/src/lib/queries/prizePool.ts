import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Currency } from "@/utils/money";

export interface PrizePayout {
  amountMinor: number;
  userId: string;
}

export interface PrizePct {
  first: number;
  second: number;
  third: number;
  secondLast: number;
}

// Mirrors the backend PrizePoolPayload (PP1a). Amounts are integer minor units.
export interface PrizePool {
  currency: Currency;
  entryFeeMinor: number;
  pct: PrizePct;
  frozen: boolean;
  poolMinor: number;
  memberCount: number;
  payouts: {
    first: PrizePayout | null;
    second: PrizePayout | null;
    third: PrizePayout | null;
    secondLast: PrizePayout | null;
  };
}

export const prizePoolKeys = {
  byLeague: (leagueId: string) => ["prize-pool", leagueId] as const,
};

// A league's prize pool + computed payouts, or null when the league has none.
export function usePrizePool(leagueId: string) {
  return useQuery({
    queryKey: prizePoolKeys.byLeague(leagueId),
    queryFn: () => apiFetch<PrizePool | null>(`/api/leagues/${leagueId}/prize-pool`),
    staleTime: 30 * 1000,
  });
}

export interface PrizePoolInput {
  currency: Currency;
  entryFeeMinor: number;
  pct: PrizePct;
}

// Admin-only. Server validates sum=100, non-increasing, and blocks once frozen.
export function useSetPrizePool(leagueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PrizePoolInput) =>
      apiFetch<PrizePool>(`/api/leagues/${leagueId}/prize-pool`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      qc.setQueryData(prizePoolKeys.byLeague(leagueId), data);
    },
  });
}

export function useDeletePrizePool(leagueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean }>(`/api/leagues/${leagueId}/prize-pool`, { method: "DELETE" }),
    onSuccess: () => {
      qc.setQueryData(prizePoolKeys.byLeague(leagueId), null);
    },
  });
}
