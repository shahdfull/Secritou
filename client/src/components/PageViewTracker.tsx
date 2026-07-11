import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "@/services/analytics.service";

/**
 * Fires a page_view analytics event whenever the route (pathname) changes.
 * Mount once inside the Router, alongside ScrollToTop.
 */
export function PageViewTracker() {
  const { pathname } = useLocation();

  useEffect(() => {
    trackPageView();
  }, [pathname]);

  return null;
}
