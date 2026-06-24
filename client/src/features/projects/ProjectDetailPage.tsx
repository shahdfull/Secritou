import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useProject } from "@/hooks/useProjects";

const STATUS_COLOR: Record<string, string> = {
  PLANNING: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  REVIEW: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-green-100 text-green-800",
};

export function ProjectDetailPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams<{ id: string }>();
  const { data: project, isLoading, isError } = useProject(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link to="/app/projects">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("projects.title")}
          </Link>
        </Button>
        <p className="text-muted-foreground">{t("projects.notFound")}</p>
      </div>
    );
  }

  const deadline = project.deadline ? new Date(project.deadline).toLocaleDateString() : ":";

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/app/projects" aria-label={t("projects.title")}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            {project.client?.name && (
              <p className="text-sm text-muted-foreground">{project.client.name}</p>
            )}
          </div>
        </div>
        <Badge className={STATUS_COLOR[project.status] ?? "bg-gray-100 text-gray-800"}>
          {t(`projects.status.${project.status.toLowerCase()}`, project.status)}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">{t("projects.budget")}</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">{project.budget || ":"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">{t("projects.deadline")}</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">{deadline}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">{t("projects.progress")}</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">{project.progress ?? 0}%</CardContent>
        </Card>
      </div>

      {project.description && (
        <Card>
          <CardHeader>
            <CardTitle>{t("common.description")}</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm">{project.description}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("projects.tasks")}</CardTitle>
        </CardHeader>
        <CardContent>
          {project.tasks && project.tasks.length > 0 ? (
            <ul className="divide-y">
              {project.tasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between py-2">
                  <span>{task.title}</span>
                  <Badge variant="outline">{task.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("projects.noTasks")}</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
