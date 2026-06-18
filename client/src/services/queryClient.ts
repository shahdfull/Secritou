import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't auto-refetch for auth bootstrap
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,

      // Conservative retry policy
      retry: (failureCount, error: any) => {
        // Don't retry auth failures
        if (error?.response?.status === 401 || error?.response?.status === 403) {
          return false;
        }
        // Retry network errors up to 3 times
        if (failureCount < 3 && !error?.response) {
          return true;
        }
        return false;
      },

      // Aggressive stale time to prevent unnecessary refetch
      staleTime: 5 * 60_000, // 5 minutes

      // Keep in cache for 30 minutes
      gcTime: 30 * 60_000,
    },

    mutations: {
      // Don't retry mutations by default (can have side effects)
      retry: 0,
    },
  },
});
