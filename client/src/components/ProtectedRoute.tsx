import { useAuthStore } from "../store/auth.store";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { getRedirectPathForRole } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export function ProtectedRoute({ children, redirectTo = "/login" }: ProtectedRouteProps) {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const bootstrapped = useAuthStore((state) => state.bootstrapped);
  const location = useLocation();

  // Still loading bootstrap
  if (status === "unknown" || !bootstrapped) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-10 animate-spin" />
      </div>
    );
  }

  // Not authenticated
  if (status === "unauthenticated") {
    return <Navigate to={redirectTo} replace />;
  }

  // Redirect based on role
  const currentPath = location.pathname;
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
      const allowedFreelancerRoutes = ["/app", "/app/missions", "/app/tasks", "/app/ai", "/app/settings"];
      const isAllowedRoute = allowedFreelancerRoutes.some(route => currentPath === route || currentPath.startsWith(route + "/"));
      if (!isAllowedRoute) {
        return <Navigate to="/app/missions" replace />;
      }
    }
  }

  return children;
}
