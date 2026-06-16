import { useMe } from "../hooks/useAuth";
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
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { isLoading, error } = useMe();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-10 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || error) {
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
  }

  return children;
}
