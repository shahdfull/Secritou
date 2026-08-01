import { useAuthStore } from "../store/auth.store";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { getRedirectPathForRole } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

// Exported for unit testing: computes the login redirect target, preserving
// the path the user was on unless they're already there (which would
// otherwise produce a "/login?redirect=/login" loop).
export function computeLoginRedirectTarget(
  redirectTo: string,
  currentPathAndQuery: string
): string {
  if (currentPathAndQuery === redirectTo) return redirectTo;
  return `${redirectTo}?redirect=${encodeURIComponent(currentPathAndQuery)}`;
}

export function ProtectedRoute({ children, redirectTo = "/login" }: ProtectedRouteProps) {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const bootstrapped = useAuthStore((state) => state.bootstrapped);
  const location = useLocation();

  // Still loading bootstrap
  if (status === "unknown" || !bootstrapped) {
    return (
      <div className="flex min-h-screen-safe items-center justify-center">
        <Loader2 className="size-10 animate-spin" />
      </div>
    );
  }

  const currentPath = location.pathname;

  // Not authenticated
  if (status === "unauthenticated") {
    // Preserve where the user was headed so a session expiring mid-navigation
    // (see the axios refresh-failure path) returns them there after login,
    // instead of dropping them on their role's default page.
    const target = computeLoginRedirectTarget(redirectTo, currentPath + location.search);
    return <Navigate to={target} replace />;
  }

  // Redirect based on role
  if (user) {
    const intendedPath = getRedirectPathForRole(user.role);
    if (currentPath.startsWith("/app") && user.role === "CLIENT") {
      return <Navigate to="/client" replace />;
    }
    if (currentPath.startsWith("/client") && user.role !== "CLIENT") {
      return <Navigate to={intendedPath} replace />;
    }
    
    // Check freelancer routes
    if (user.role === "FREELANCER") {
      if (currentPath === "/app") return <Navigate to="/app/freelancer-dashboard" replace />;
      const allowedFreelancerRoutes = ["/app/freelancer-dashboard", "/app/projects", "/app/tasks", "/app/documents", "/app/settings"];
      const isAllowedRoute = allowedFreelancerRoutes.some(route => currentPath === route || currentPath.startsWith(route + "/"));
      if (!isAllowedRoute) {
        return <Navigate to="/app/freelancer-dashboard" replace />;
      }
    }

    // SEC-091: routes whose backend is 100% authorize("ADMIN") (booking.routes.ts) have no
    // legitimate MANAGER data to show — unlike commissions, where MANAGER gets a real /my
    // variant. Blocked here the same way FREELANCER's out-of-scope routes are, instead of
    // relying on the page component to notice its own 403s.
    if (user.role === "MANAGER") {
      const adminOnlyRoutes = ["/app/booking"];
      const isBlockedRoute = adminOnlyRoutes.some(route => currentPath === route || currentPath.startsWith(route + "/"));
      if (isBlockedRoute) {
        return <Navigate to="/app" replace />;
      }
    }
  }

  return children;
}
