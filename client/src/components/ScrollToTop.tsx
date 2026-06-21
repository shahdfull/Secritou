import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls the window back to the top whenever the route (pathname) changes.
 * Mount once inside the Router. Anchor links (with a hash) are left untouched.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return; // let in-page anchors handle their own scroll
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, hash]);

  return null;
}
