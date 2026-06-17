import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../types/auth";

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
        }),
      setToken: (token) =>
        set({
          accessToken: token,
        }),
      logout: () =>
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: "secritou-auth-storage",
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    },
  ),
);
