import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usersApi, type UpdateUserInput } from "../api/users.api";
import { gdprApi, type GdprEraseResult } from "../api/gdpr.api";
import { toast } from "sonner";
import i18n from "@/i18n";
import { downloadJson } from "@/utils/downloadJson";

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

export function useGdprExportUser() {
  return useMutation<unknown, Error, string>({
    mutationFn: (id) => gdprApi.exportUser(id),
    onSuccess: (data, id) => {
      downloadJson(data, `user-${id}-rgpd-export.json`);
      toast.success(i18n.t("toasts.gdprExported", "Export RGPD téléchargé"));
    },
  });
}

export function useGdprEraseUser() {
  const queryClient = useQueryClient();
  return useMutation<GdprEraseResult, Error, string>({
    mutationFn: (id) => gdprApi.eraseUser(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(
        result.mode === "deleted"
          ? i18n.t("toasts.gdprUserDeleted", "Utilisateur supprimé (RGPD)")
          : i18n.t("toasts.gdprUserAnonymized", "Données personnelles anonymisées (RGPD)")
      );
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
