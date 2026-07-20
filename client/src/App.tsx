import { QueryClientProvider } from "@tanstack/react-query";
import { SEO } from "@/components/common/SEO";
import { GlobalErrorBoundary } from "@/components/common/GlobalErrorBoundary";
import { Toaster } from "@/components/ui/sonner";
import { usePageViewTracking } from "@/hooks/usePageViewTracking";
import { useSessionHeartbeat } from "@/hooks/useSessionHeartbeat";
import { AppRoutes } from "@/routes/AppRoutes";
import { queryClient } from "@/services/queryClient";
import { useBootstrapSession } from "@/hooks/useAuth";
import { getAnnounceEventName } from "@/lib/a11yAnnounce";
import { useEffect, useState } from "react";

function A11yAnnouncer() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<string>;
      setMessage(custom.detail);
    };

    window.addEventListener(getAnnounceEventName(), handler as EventListener);
    return () => window.removeEventListener(getAnnounceEventName(), handler as EventListener);
  }, []);

  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}

function AppContent() {
  // Bootstrap session on app startup (uses HTTP-only cookie for refresh)
  useBootstrapSession();

  usePageViewTracking();
  useSessionHeartbeat();

  return (
    <>
      <SEO />
      <A11yAnnouncer />
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
