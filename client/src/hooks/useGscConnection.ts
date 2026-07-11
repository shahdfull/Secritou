import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { gscConnectionApi } from "@/api/gscConnection.api";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function useGscStatus(clientId: string) {
  return useQuery({
    queryKey: ["gscStatus", clientId],
    queryFn: () => gscConnectionApi.getStatus(clientId),
    enabled: !!clientId,
  });
}

export function useStartGscConnect(clientId: string) {
  return useMutation({
    mutationFn: () => gscConnectionApi.startConnect(clientId),
  });
}

export function useCompleteGscConnect(clientId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ pendingId, siteUrl }: { pendingId: string; siteUrl: string }) =>
      gscConnectionApi.completeConnect(clientId, pendingId, siteUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gscStatus", clientId] });
      toast.success(t("integrations.gsc.connected", "Search Console connecté"));
    },
  });
}

export function useDisconnectGsc(clientId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: () => gscConnectionApi.disconnect(clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gscStatus", clientId] });
      toast.success(t("integrations.gsc.disconnected", "Search Console déconnecté"));
    },
  });
}

export function useClientMetrics(clientId: string, params?: { metric?: string; from?: string; to?: string }) {
  return useQuery({
    queryKey: ["clientMetrics", clientId, params],
    queryFn: () => gscConnectionApi.getMetrics(clientId, params),
    enabled: !!clientId,
  });
}
