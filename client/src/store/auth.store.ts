import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User } from "../types/auth";

export type AuthStatus = "unknown" | "authenticated" | "unauthenticated";

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  status: AuthStatus;
  bootstrapped: boolean;
  setSession: (session: { user: User; accessToken: string }) => void;
  setAccessToken: (accessToken: string | null) => void;
  setUser: (user: User | null) => void;
  setAuthenticated: (user: User, accessToken?: string) => void;
  setUnauthenticated: () => void;
  markBootstrapped: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      status: "unknown",
      bootstrapped: false,

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
        }),
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
