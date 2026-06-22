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

export const useAuthStore = create<AuthStore>(
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
      partialize: (state) => ({
        user: state.user,
        status: state.status,
        bootstrapped: state.bootstrapped,
      }),
    }
  )
);
