import { QueryClientProvider } from "@tanstack/react-query";
import { SEO } from "@/components/common/SEO";
import { GlobalErrorBoundary } from "@/components/common/GlobalErrorBoundary";
import { Toaster } from "@/components/ui/sonner";
import { usePageViewTracking } from "@/hooks/usePageViewTracking";
import { AppRoutes } from "@/routes/AppRoutes";
import { queryClient } from "@/services/queryClient";

export function App() {
  usePageViewTracking();

  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SEO />
        <AppRoutes />
        <Toaster richColors position="top-right" />
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}
