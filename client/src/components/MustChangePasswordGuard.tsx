import { useEffect } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/auth.store";

export function MustChangePasswordGuard() {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (status === "authenticated" && user?.mustChangePassword && location.pathname !== "/change-password") {
      navigate("/change-password", { replace: true });
    }
  }, [user, navigate, location, status]);

  // If user must change password, only render outlet if we're on /change-password
  if (status === "authenticated" && user?.mustChangePassword && location.pathname !== "/change-password") {
    return null;
  }

  return <Outlet />;
}
