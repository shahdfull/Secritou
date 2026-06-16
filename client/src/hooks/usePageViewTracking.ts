import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function usePageViewTracking() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.gtag?.("event", "page_view", {
      page_path: location.pathname,
      page_location: window.location.href,
    });
    window.posthog?.capture("$pageview", {
      page_path: location.pathname,
      page_url: window.location.href,
    });
  }, [location.pathname]);
}

