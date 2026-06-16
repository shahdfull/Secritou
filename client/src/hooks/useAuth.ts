import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../api/auth.api";
import { useAuthStore } from "../store/auth.store";
import type { LoginCredentials, RegisterCredentials, User } from "../types/auth";
import { toast } from "sonner";

export function useMe() {
  const setUser = useAuthStore((state) => state.setUser);
  return useQuery<User>({
    queryKey: ["me"],
    queryFn: async () => {
      const user = await authApi.getMe();
      setUser(user);
      return user;
    },
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  const setToken = useAuthStore((state) => state.setToken);
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      return await authApi.login(credentials);
    },
    onSuccess: async (data) => {
      setToken(data.tokens.accessToken);
      setUser(data.user);
      queryClient.setQueryData(["me"], data.user);
      toast.success("Login successful");
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
    mutationFn: async (credentials: RegisterCredentials) => {
      return await authApi.register(credentials);
    },
    onSuccess: async (data) => {
      setToken(data.tokens.accessToken);
      setUser(data.user);
      queryClient.setQueryData(["me"], data.user);
      toast.success("Registration successful");
    },
  });
}

export function useLogout() {
  const logoutStore = useAuthStore((state) => state.logout);
  const refreshToken = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    },
    onSuccess: () => {
      logoutStore();
      queryClient.clear();
      toast.success("Logout successful");
    },
  });
}
