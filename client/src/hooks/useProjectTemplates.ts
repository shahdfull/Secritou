import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectTemplatesApi } from "@/api/projectTemplates.api";
import { toast } from "sonner";

export function useProjectTemplateForService(serviceId: string | null | undefined) {
  return useQuery({
    queryKey: ["projectTemplate", serviceId],
    queryFn: () => projectTemplatesApi.getForService(serviceId as string),
    enabled: !!serviceId,
    staleTime: 5 * 60_000,
  });
}

export function useApplyProjectTemplate(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => projectTemplatesApi.applyToProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Tâches créées à partir du template");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erreur lors de l'application du template");
    },
  });
}
