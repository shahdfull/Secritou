import { QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy } from "react";
import { queryClient } from "../services/queryClient";

interface QueryProviderProps {
  children: React.ReactNode;
}

const ReactQueryDevtools = lazy(async () => {
  const mod = await import("@tanstack/react-query-devtools");
  return { default: mod.ReactQueryDevtools };
});

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {import.meta.env.DEV ? (
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} />
        </Suspense>
      ) : null}
    </QueryClientProvider>
  );
}
