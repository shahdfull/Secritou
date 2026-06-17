import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usersApi, type UpdateUserInput } from "../api/users.api";
import { toast } from "sonner";
import i18n from "@/i18n";

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.getUsers(),
    select: (result) => result.data,
    staleTime: 2 * 60_000,
  });
}

export function useInviteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.inviteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(i18n.t("toasts.userInvited"));
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserInput }) =>
      usersApi.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(i18n.t("toasts.userUpdated"));
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(i18n.t("toasts.userDeleted"));
    },
  });
}

export function usePermissions() {
  return useQuery({
    queryKey: ["permissions"],
    queryFn: usersApi.getPermissions,
    staleTime: 10 * 60_000,
  });
}
