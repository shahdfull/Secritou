import { QueryClientProvider } from "@tanstack/react-query";
import { SEO } from "@/components/common/SEO";
import { GlobalErrorBoundary } from "@/components/common/GlobalErrorBoundary";
import { Toaster } from "@/components/ui/sonner";
import { usePageViewTracking } from "@/hooks/usePageViewTracking";
import { useSessionHeartbeat } from "@/hooks/useSessionHeartbeat";
import { AppRoutes } from "@/routes/AppRoutes";
import { queryClient } from "@/services/queryClient";
import { useBootstrapSession } from "@/hooks/useAuth";

function AppContent() {
  // Bootstrap session on app startup (uses HTTP-only cookie for refresh)
  useBootstrapSession();

  usePageViewTracking();
  useSessionHeartbeat();

  return (
    <>
      <SEO />
      <AppRoutes />
      <Toaster richColors position="top-right" />
    </>
  );
}

export function App() {
  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}
