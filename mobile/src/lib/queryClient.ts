import { QueryClient } from "@tanstack/react-query";

// Shared TanStack Query client (MOBILE_PLAN.md §5.5). Per-query staleTimes are
// set on the individual hooks in the Stage D data slices; these are the
// conservative defaults. RN has no window focus, so refetchOnWindowFocus is
// off here and re-fetch-on-foreground is wired via AppState later.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
