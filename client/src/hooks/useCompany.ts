import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { companyApi } from "../api/company.api";
import type { Company, UpdateCompanyInput } from "../types/company";
import { toast } from "sonner";
import i18n from "@/i18n";

export function useCompany() {
  return useQuery<Company>({
    queryKey: ["company"],
    queryFn: companyApi.get,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();

  return useMutation<Company, Error, UpdateCompanyInput>({
    mutationFn: (data) => companyApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company"] });
      toast.success(i18n.t("toasts.companyUpdated"));
    },
  });
}
