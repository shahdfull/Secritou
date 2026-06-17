import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../api/auth.api";
import { useAuthStore } from "../store/auth.store";
import type { LoginCredentials, RegisterCredentials, User } from "../types/auth";
import { toast } from "sonner";
import i18n from "@/i18n";

export function useMe() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const setUser = useAuthStore((state) => state.setUser);
  return useQuery<User>({
    queryKey: ["me"],
    queryFn: async () => {
      const user = await authApi.getMe();
      setUser(user);
      return user;
    },
    enabled: !!accessToken,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  const setToken = useAuthStore((state) => state.setToken);
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: async (credentials: LoginCredentials) => authApi.login(credentials),
    onSuccess: async (data) => {
      setToken(data.tokens.accessToken);
      setUser(data.user);
      queryClient.setQueryData(["me"], data.user);
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
    default:
      return "/app";
  }
}

export function useRegister() {
  const queryClient = useQueryClient();
  const setToken = useAuthStore((state) => state.setToken);
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: async (credentials: RegisterCredentials) => authApi.register(credentials),
    onSuccess: async (data) => {
      setToken(data.tokens.accessToken);
      setUser(data.user);
      queryClient.setQueryData(["me"], data.user);
      toast.success(i18n.t("toasts.registrationSuccess"));
    },
  });
}

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
    onSuccess: (_, __, context) => {
      const user = useAuthStore.getState().user;
      if (user) {
        const updatedUser = { ...user, mustChangePassword: false };
        setUser(updatedUser);
        queryClient.setQueryData(["me"], updatedUser);
      }
      toast.success(i18n.t("auth.passwordChanged"));
    },
  });
}
