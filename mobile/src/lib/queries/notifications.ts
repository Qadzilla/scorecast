import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface NotificationPrefs {
  deadlines: boolean;
  results: boolean;
  updates: boolean;
}

export const notificationKeys = {
  prefs: ["notification-prefs"] as const,
};

// Current user's notification preferences (server defaults to all-on).
export function useNotificationPrefs() {
  return useQuery({
    queryKey: notificationKeys.prefs,
    queryFn: () => apiFetch<NotificationPrefs>("/api/notifications/prefs"),
    staleTime: 5 * 60 * 1000,
  });
}

// Optimistic upsert — the switch flips instantly, rolls back on error.
export function useUpdateNotificationPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prefs: NotificationPrefs) =>
      apiFetch<NotificationPrefs>("/api/notifications/prefs", {
        method: "PUT",
        body: JSON.stringify(prefs),
      }),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: notificationKeys.prefs });
      const prev = qc.getQueryData<NotificationPrefs>(notificationKeys.prefs);
      qc.setQueryData(notificationKeys.prefs, next);
      return { prev };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev) qc.setQueryData(notificationKeys.prefs, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.prefs });
    },
  });
}
