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
}

// Mirrors the backend PrizePoolPayload. Amounts are integer minor units.
// 2nd-last is always "money back" (the entry fee); 3rd is money-back when
// `thirdMoneyBack`. The percentages (1st/2nd/3rd-if-%) split what remains.
export interface PrizePool {
  currency: Currency;
  entryFeeMinor: number;
  pct: PrizePct;
  thirdMoneyBack: boolean;
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
  thirdMoneyBack: boolean;
}

// leagueId travels in the mutate payload (not bound to the hook) so create — which
// only learns the id after the league exists — can set a pool for the new league.
// Admin-only; server validates sum=100, non-increasing, and blocks once frozen.
export function useSetPrizePool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leagueId, ...input }: PrizePoolInput & { leagueId: string }) =>
      apiFetch<PrizePool>(`/api/leagues/${leagueId}/prize-pool`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: (data, variables) => {
      qc.setQueryData(prizePoolKeys.byLeague(variables.leagueId), data);
    },
  });
}

export function useDeletePrizePool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leagueId: string) =>
      apiFetch<{ success: boolean }>(`/api/leagues/${leagueId}/prize-pool`, { method: "DELETE" }),
    onSuccess: (_data, leagueId) => {
      qc.setQueryData(prizePoolKeys.byLeague(leagueId), null);
    },
  });
}
