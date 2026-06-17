import { useEffect } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/auth.store";

export function MustChangePasswordGuard() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user?.mustChangePassword && location.pathname !== "/change-password") {
      navigate("/change-password");
    }
  }, [user, navigate, location]);

  return <Outlet />;
}
