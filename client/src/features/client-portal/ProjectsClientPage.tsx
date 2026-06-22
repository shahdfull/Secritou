import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/api/axios";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectTimeline } from "./components/ProjectTimeline";

const getStatusColor = (status: string) => {
  switch (status) {
    case "PLANNING":
      return "bg-blue-100 text-blue-800";
    case "IN_PROGRESS":
      return "bg-yellow-100 text-yellow-800";
    case "REVIEW":
      return "bg-purple-100 text-purple-800";
    case "COMPLETED":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getStatusText = (status: string, t: (key: string) => string) => {
  switch (status) {
    case "PLANNING":
      return "Planification";
    case "IN_PROGRESS":
      return "En cours";
    case "REVIEW":
      return "En revue";
    case "COMPLETED":
      return "Terminé";
    default:
      return status;
  }
};

const statusOrder = ["PLANNING", "IN_PROGRESS", "REVIEW", "COMPLETED"];

function useMyProjects() {
  return useQuery({
    queryKey: ["client-projects"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: unknown[]; total: number }>("/projects/my", {
        params: { page: 1, pageSize: 100 },
      });
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function ProjectsClientPage() {
  const { t } = useTranslation();
  const { data: projectsResult, isLoading } = useMyProjects();
  const projects = (projectsResult?.data ?? []) as Array<{
    id: string;
    name: string;
    status: string;
    progress?: number;
  }>;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="container-page max-w-6xl mx-auto py-8">
      <h1 className="text-3xl font-bold text-ink mb-8">Mes Projets</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projects?.map((project) => {
          const progress = project.progress ?? 0;

          return (
            <Card key={project.id} className="rounded-3xl border border-border shadow-soft">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-xl font-bold text-ink">{project.name}</CardTitle>
                  <Badge className={getStatusColor(project.status)}>
                    {getStatusText(project.status, t)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <div className="flex justify-between text-sm text-muted-foreground mb-1">
                    <span>Progression</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <ProjectTimeline projectId={project.id} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
