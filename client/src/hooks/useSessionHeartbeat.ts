import { useEffect } from "react";
import { usersApi } from "@/api/users.api";
import { useMe } from "./useAuth";

// Must stay below the server's SESSION_IDLE_TIMEOUT_MINUTES (3 min, see
// userSession.repository.ts) so a missed tick doesn't split one visit into two sessions.
const HEARTBEAT_INTERVAL_MS = 60_000;

// Pings the server periodically while the back-office tab is open and in the foreground,
// so admin/manager connected-time can be tracked (see SettingsUsersTab). Skipped for
// unauthenticated visitors and hidden/backgrounded tabs — a hidden tab isn't "in use".
export function useSessionHeartbeat() {
  const { status } = useMe();
  const isAuthenticated = status === "authenticated";

  useEffect(() => {
    if (!isAuthenticated) return;

    function ping() {
      if (document.visibilityState !== "visible") return;
      void usersApi.sendHeartbeat();
    }

    ping();
    const interval = setInterval(ping, HEARTBEAT_INTERVAL_MS);
    document.addEventListener("visibilitychange", ping);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [isAuthenticated]);
}
