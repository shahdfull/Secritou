import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../api/auth.api";
import { usersApi, type UpdateMeInput } from "../api/users.api";
import { useAuthStore } from "../store/auth.store";
import type { LoginCredentials, RegisterCredentials, User } from "../types/auth";
import { toast } from "sonner";
import i18n from "@/i18n";
import { useEffect } from "react";

// ============ BOOTSTRAP SESSION ============
// Called once on app startup to restore session from localStorage/HTTP-only cookie
export function useBootstrapSession() {
  const status = useAuthStore((state) => state.status);
  const bootstrapped = useAuthStore((state) => state.bootstrapped);
  const markBootstrapped = useAuthStore((state) => state.markBootstrapped);
  const accessToken = useAuthStore((state) => state.accessToken);

  // Query to refresh session using HTTP-only cookie
  const query = useQuery({
    queryKey: ["auth.bootstrap"],
    queryFn: async () => {
      // Try to refresh using HTTP-only cookie
      const data = await authApi.refresh();
      return data;
    },
    // Only run if haven't bootstrapped yet and have no token in storage
    enabled: !bootstrapped && !accessToken,
    retry: false,
    staleTime: Infinity, // Never stale, only runs once
    gcTime: 0, // Don't keep in cache
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Handle bootstrap completion
  useEffect(() => {
    if (bootstrapped) return; // already done

    if (accessToken) {
      // Token restored from localStorage, no need to refresh
      markBootstrapped();
    } else if (query.isSuccess && query.data) {
      // Successfully refreshed session
      useAuthStore.getState().setSession({
        user: query.data.user,
        accessToken: query.data.tokens.accessToken,
      });
      markBootstrapped();
    } else if (query.isError) {
      // Failed to refresh, mark as unauthenticated
      useAuthStore.getState().setUnauthenticated();
      markBootstrapped();
    }
  }, [query.isSuccess, query.isError, query.data, bootstrapped, markBootstrapped, accessToken]);

  return query;
}

// ============ GET CURRENT USER ============
// Returns current authenticated user (no refetch, just from store)
export function useMe() {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);

  // Return cached data from store
  return {
    user,
    status,
    isLoading: status === "unknown",
    isError: status === "unauthenticated",
  };
}

// ============ LOGIN ============
export function useLogin() {
  const queryClient = useQueryClient();
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: async (credentials: LoginCredentials) => authApi.login(credentials),
    onSuccess: async (data) => {
      setSession({ user: data.user, accessToken: data.tokens.accessToken });
      queryClient.setQueryData(["auth.bootstrap"], data);
      toast.success(i18n.t("toasts.loginSuccess"));
    },
  });
}

export function getRedirectPathForRole(role: string) {
  switch (role) {
    case "CLIENT":
      return "/client";
    case "FREELANCER":
      return "/app/missions";
    case "ADMIN":
    case "MANAGER":
    default:
      return "/app";
  }
}

// ============ REGISTER ============
export function useRegister() {
  const queryClient = useQueryClient();
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: async (credentials: RegisterCredentials) => authApi.register(credentials),
    onSuccess: async (data) => {
      setSession({ user: data.user, accessToken: data.tokens.accessToken });
      queryClient.setQueryData(["auth.bootstrap"], data);
      toast.success(i18n.t("toasts.registrationSuccess"));
    },
  });
}

// ============ LOGOUT ============
export function useLogout() {
  const logoutStore = useAuthStore((state) => state.logout);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => authApi.logout(),
    onSuccess: () => {
      logoutStore();
      queryClient.clear();
      toast.success(i18n.t("toasts.logoutSuccess"));
    },
  });
}

// ============ UPDATE PROFILE ============
export function useUpdateMe() {
  const setUser = useAuthStore((state) => state.setUser);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateMeInput) => usersApi.updateMe(data),
    onSuccess: (updatedUser: User) => {
      setUser(updatedUser);
      queryClient.setQueryData(["auth.bootstrap"], (prev: any) =>
        prev ? { ...prev, user: updatedUser } : undefined
      );
      toast.success(i18n.t("toasts.profileUpdated", "Profil mis à jour avec succès"));
    },
    onError: (error: Error) => {
      toast.error(error.message ?? i18n.t("errors.generic", "Une erreur est survenue"));
    },
  });
}

// ============ CHANGE PASSWORD ============
export function useChangePassword() {
  const setUser = useAuthStore((state) => state.setUser);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => authApi.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      const user = useAuthStore.getState().user;
      if (user) {
        const updatedUser = { ...user, mustChangePassword: false };
        setUser(updatedUser);
        queryClient.setQueryData(["auth.bootstrap"], (prev: any) =>
          prev ? { ...prev, user: updatedUser } : undefined
        );
      }
      toast.success(i18n.t("auth.passwordChanged"));
    },
  });
}
