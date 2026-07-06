import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { authApi } from "../api/auth.api";
import { usersApi, type UpdateMeInput } from "../api/users.api";
import { useAuthStore } from "../store/auth.store";
import type { AuthTokens, LoginCredentials, RegisterCredentials, User } from "../types/auth";
import { toast } from "sonner";
import i18n from "@/i18n";
import { useEffect } from "react";

// Maps a failed login's HTTP status to a translated, user-facing toast message.
function loginErrorMessage(error: AxiosError): string {
  const status = error.response?.status;
  if (status === 401) return i18n.t("auth.invalidCredentials");
  if (status === 429) return i18n.t("auth.tooManyAttempts");
  if (!error.response) return i18n.t("errors.network");
  return i18n.t("toasts.genericError");
}

// ============ BOOTSTRAP SESSION ============
// Called once on app startup to restore session from the HTTP-only refresh cookie.
//
// FIX: The previous implementation had two bugs:
//
// 1. `enabled: !bootstrapped && !accessToken` — because `bootstrapped` was
//    persisted in localStorage, it was already `true` on every page reload,
//    which caused the condition to be `false` immediately. The refresh query
//    was therefore never fired, leaving `accessToken` as null in memory while
//    `status` was still "authenticated" from localStorage — producing 401s on
//    every protected API call.
//
// 2. `accessToken` was included in the `enabled` guard, but it is never
//    persisted (by design), so it is always `null` on startup and should not
//    be used as a skip signal here.
//
// Fix: `bootstrapped` is no longer persisted (see auth.store.ts), so it always
// starts as `false`. The `enabled` condition now only checks `!bootstrapped`,
// which correctly runs the refresh once per page load and never again.
export function useBootstrapSession() {
  const bootstrapped = useAuthStore((state) => state.bootstrapped);
  const markBootstrapped = useAuthStore((state) => state.markBootstrapped);

  // Query to refresh session using HTTP-only cookie
  const query = useQuery({
    queryKey: ["auth.bootstrap"],
    queryFn: async () => {
      const data = await authApi.refresh();
      return data;
    },
    // FIX: only skip if already bootstrapped this session.
    // `bootstrapped` is no longer persisted, so this is always false on first load.
    enabled: !bootstrapped,
    retry: false,
    staleTime: Infinity, // Never stale, only runs once
    gcTime: 0,           // Don't keep in cache
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Handle bootstrap completion
  useEffect(() => {
    if (bootstrapped) return; // already done this session

    if (query.isSuccess && query.data) {
      // Successfully refreshed — store the new token and user
      useAuthStore.getState().setSession({
        user: query.data.user,
        accessToken: query.data.tokens.accessToken,
      });
      markBootstrapped();
    } else if (query.isError) {
      // Refresh cookie missing or expired — user must log in again
      useAuthStore.getState().setUnauthenticated();
      markBootstrapped();
    }
  }, [query.isSuccess, query.isError, query.data, bootstrapped, markBootstrapped]);

  return query;
}

// ============ GET CURRENT USER ============
// Returns current authenticated user (no refetch, just from store)
export function useMe() {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);

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

  return useMutation<{ user: User; tokens: AuthTokens }, AxiosError, LoginCredentials>({
    mutationFn: async (credentials: LoginCredentials) => authApi.login(credentials),
    onSuccess: async (data) => {
      setSession({ user: data.user, accessToken: data.tokens.accessToken });
      queryClient.setQueryData(["auth.bootstrap"], data);
      toast.success(i18n.t("toasts.loginSuccess"));
    },
    onError: (error) => {
      toast.error(loginErrorMessage(error));
    },
  });
}

export function getRedirectPathForRole(role: string) {
  switch (role) {
    case "CLIENT":
      return "/client";
    case "FREELANCER":
      return "/app/freelancer-dashboard";
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