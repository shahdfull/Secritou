import { useQuery } from "@tanstack/react-query";
import { servicesApi } from "@/api/services.api";
import { useAuthStore } from "@/store/auth.store";

export function useServices() {
  const role = useAuthStore((s) => s.user?.role);
  return useQuery({
    queryKey: ["services"],
    queryFn: servicesApi.getServices,
    staleTime: 10 * 60_000,
    enabled: role === "ADMIN",
  });
}
