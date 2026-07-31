import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User } from "../types/auth";
import type { PermissionsMap, Module } from "../types/permissions";
import { managerPermissionsApi } from "../api/managerPermissions.api";

export type AuthStatus = "unknown" | "authenticated" | "unauthenticated";

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  status: AuthStatus;
  bootstrapped: boolean;
  permissions: PermissionsMap | null;
  setSession: (session: { user: User; accessToken: string }) => void;
  setAccessToken: (accessToken: string | null) => void;
  setUser: (user: User | null) => void;
  setAuthenticated: (user: User, accessToken?: string) => void;
  setUnauthenticated: () => void;
  markBootstrapped: () => void;
  logout: () => void;
  fetchMyPermissions: () => Promise<void>;
  can: (module: Module, action: keyof { read: boolean; create: boolean; update: boolean; delete: boolean }) => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      status: "unknown",
      bootstrapped: false,
      permissions: null,

      setSession: ({ user, accessToken }) =>
        set({
          user,
          accessToken,
          status: "authenticated",
        }),

      setAccessToken: (accessToken) =>
        set({ accessToken }),

      setUser: (user) =>
        set((state) => ({
          user,
          status: state.status === "unknown" ? state.status : user ? "authenticated" : "unauthenticated",
        })),

      setAuthenticated: (user, accessToken) =>
        set({
          user,
          accessToken: accessToken ?? null,
          status: "authenticated",
        }),

      setUnauthenticated: () =>
        set({
          user: null,
          accessToken: null,
          status: "unauthenticated",
          permissions: null,
        }),

      markBootstrapped: () =>
        set((state) => ({
          status: state.user ? "authenticated" : "unauthenticated",
          bootstrapped: true,
        })),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          status: "unauthenticated",
          permissions: null,
        }),

      fetchMyPermissions: async () => {
        try {
          const permissions = await managerPermissionsApi.getMyPermissions();
          set({ permissions });
        } catch (error) {
          console.error("Failed to fetch permissions:", error);
        }
      },

      can: (module, action) => {
        const state = get();
        if (state.user?.role === "ADMIN") return true;
        if (state.user?.role !== "MANAGER") return false;
        return !!state.permissions?.[module]?.[action];
      },
    }),
    {
      name: "auth-store",
      storage: createJSONStorage(() => localStorage),
      // FIX (SEC-068): `bootstrapped`, `accessToken`, and now `status` are intentionally NOT
      // persisted.
      // - `accessToken` is an in-memory-only token (short-lived, security best practice).
      // - `bootstrapped` must reset to false on every page reload so that
      //   useBootstrapSession always calls /auth/refresh to obtain a fresh token
      //   via the HTTP-only cookie. Persisting it caused the app to skip the
      //   refresh call, leaving accessToken as null and causing 401 errors on all
      //   protected API requests.
      // - `status` persisted as "authenticated" let any consumer (e.g.
      //   useSessionHeartbeat) treat the session as ready on the very first render after a
      //   reload, before useBootstrapSession had obtained a real accessToken — firing an
      //   Authorization-less request that 401's, which the axios interceptor "fixed" by
      //   kicking off its OWN /auth/refresh in parallel with useBootstrapSession's. Two
      //   refreshes racing for the same single-use refresh token cookie: the loser's rotated
      //   cookie no longer matches any stored row, tripping the reuse-detection guard in
      //   auth.service.ts#refresh and revoking the entire refresh token family — the very
      //   "session expired immediately after reload" symptom this fixes. `status` now starts
      //   at "unknown" on every reload and only becomes "authenticated" once
      //   useBootstrapSession's single refresh call actually resolves.
      partialize: (state) => ({
        user: state.user,
      }),
    }
  )
);