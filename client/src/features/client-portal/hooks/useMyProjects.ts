import { useQuery } from "@tanstack/react-query";
import apiClient from "@/api/axios";

export interface ClientProject {
  id: string;
  name: string;
  status: string;
  progress?: number;
  clientApprovedAt?: string | null;
}

// Shared between ProjectsClientPage and ClientDashboardPage's "Projets" stat card — both must
// read the same query (same key, same /projects/my endpoint) so the two screens can't drift out
// of sync (e.g. a project counted on the dashboard but not shown, or vice versa).
export function useMyProjects() {
  return useQuery({
    queryKey: ["client-projects"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: ClientProject[]; total: number }>("/projects/my", {
        params: { page: 1, pageSize: 100 },
      });
      return res.data;
    },
    staleTime: 60_000,
  });
}
