import { useParams, Link, useNavigate } from "react-router-dom";
import { formatDate } from "@/utils/format";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Loader2, ExternalLink, FileText, CheckSquare, Activity, ClipboardCheck, Upload, X } from "lucide-react";
import { useProject, useUpdateProject } from "@/hooks/useProjects";
import { useMe } from "@/hooks/useAuth";
import { TASK_STATUSES } from "@secritou/shared";
import { TimeTrackingTab } from "./TimeTrackingTab";
import { ApprovalsPage } from "@/features/approvals/ApprovalsPage";
import { TabErrorBoundary } from "@/components/ui/TabErrorBoundary";
import { toast } from "sonner";
import { FileUploadField } from "@/components/common/FileUploadField";
import { useCreateDocument, useDocuments } from "@/hooks/useDocuments";
import type { UploadResult } from "@/api/upload.api";

const STATUS_COLOR: Record<string, string> = {
  PLANNING: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  REVIEW: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-green-100 text-green-800",
};

const TASK_STATUS_COLOR: Record<string, string> = {
  TODO: "bg-gray-100 text-gray-600",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  REVIEW: "bg-purple-100 text-purple-700",
  DONE: "bg-green-100 text-green-700",
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  PLANNING: ["IN_PROGRESS"],
  IN_PROGRESS: ["PLANNING", "REVIEW"],
  REVIEW: ["IN_PROGRESS"],
  COMPLETED: [],
};

const STATUS_LABELS: Record<string, string> = {
  PLANNING: "Planification",
  IN_PROGRESS: "En cours",
  REVIEW: "Révision",
  COMPLETED: "Terminé",
};

const TASK_STATUS_LABELS: Record<string, string> = {
  TODO: "À faire",
  IN_PROGRESS: "En cours",
  REVIEW: "Révision",
  DONE: "Terminé",
};

export function ProjectDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id = "" } = useParams<{ id: string }>();
  const { data: project, isLoading, isError } = useProject(id);
  const { user } = useMe();
  const { mutate: updateProject, isPending: isUpdating } = useUpdateProject();

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<string>("");
  const [deliverableName, setDeliverableName] = useState("");
  const uploadedDeliverable = useRef<UploadResult | null>(null);
  const { mutate: createDocument, isPending: isUploadingDeliverable } = useCreateDocument();
  const { data: myDocsResult } = useDocuments({ page: 1, pageSize: 50 });

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

  const isAdminOrManager = user?.role === "ADMIN" || user?.role === "MANAGER";
  const isFreelancer = user?.role === "FREELANCER";
  const canChangeStatus = isAdminOrManager && project.status !== "COMPLETED";
  const validTransitions = VALID_TRANSITIONS[project.status] ?? [];
  const deadline = project.deadline ? formatDate(project.deadline) : "—";

  const tasks = project.tasks ?? [];
  const taskCountByStatus = tasks.reduce<Record<string, number>>((acc, task) => {
    acc[task.status] = (acc[task.status] ?? 0) + 1;
    return acc;
  }, {});
  const displayedTasks = tasks.slice(0, 5);

  const handleStatusChange = () => {
    if (!targetStatus) return;
    updateProject(
      { id: project.id, data: { status: targetStatus as typeof project.status } },
      {
        onSuccess: () => {
          setStatusDialogOpen(false);
          toast.success(`Statut changé vers ${STATUS_LABELS[targetStatus]}`);
        },
      }
    );
  };

  const tabTriggerClass =
    "rounded-none border-b-2 border-transparent data-[state=active]:border-ink data-[state=active]:text-ink data-[state=active]:shadow-none bg-transparent px-0 pb-2 text-sm font-medium text-muted-foreground flex items-center gap-1.5";

  return (
    <section className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/app/projects" className="hover:text-ink transition-colors">
          {t("projects.title")}
        </Link>
        <span className="select-none">/</span>
        <span className="text-ink font-medium truncate max-w-xs">{project.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink">{project.name}</h1>
            {project.client?.name && (
              <p className="text-sm text-muted-foreground">{project.client.name}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={STATUS_COLOR[project.status] ?? "bg-gray-100 text-gray-800"}>
            {STATUS_LABELS[project.status] ?? project.status}
          </Badge>
          {canChangeStatus && validTransitions.length > 0 && (
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setStatusDialogOpen(true)}>
              Changer de statut
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border border-border shadow-none">
          <CardHeader className="px-5 pt-5 pb-1">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">{t("projects.budget")}</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 text-lg font-semibold">{project.budget || "—"}</CardContent>
        </Card>
        <Card className="rounded-2xl border border-border shadow-none">
          <CardHeader className="px-5 pt-5 pb-1">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">{t("projects.deadline")}</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 text-lg font-semibold">{deadline}</CardContent>
        </Card>
        <Card className="rounded-2xl border border-border shadow-none">
          <CardHeader className="px-5 pt-5 pb-1">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Progression</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-2">
            <p className="text-lg font-semibold">{project.progress ?? 0}%</p>
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${project.progress ?? 0}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Basé sur les tâches complétées ({project.taskDone ?? 0}/{project.taskTotal ?? 0})
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Task breakdown by status */}
      {tasks.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {TASK_STATUSES.map((s) => (
            <div key={s} className="text-center rounded-xl border border-border py-3 px-2">
              <p className="text-xl font-bold text-ink">{taskCountByStatus[s] ?? 0}</p>
              <Badge className={`${TASK_STATUS_COLOR[s]} text-[10px] mt-1`}>
                {TASK_STATUS_LABELS[s]}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Description */}
      {project.description && (
        <Card className="rounded-2xl border border-border shadow-none">
          <CardHeader className="px-5 pt-5 pb-1">
            <CardTitle className="text-sm font-semibold">{t("common.description")}</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 whitespace-pre-wrap text-sm text-muted-foreground">
            {project.description}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="tasks">
        <TabsList className="bg-transparent border-b border-border rounded-none p-0 h-auto gap-6">
          <TabsTrigger value="tasks" className={tabTriggerClass}>
            <CheckSquare className="h-3.5 w-3.5" />
            Tâches
          </TabsTrigger>
          {isAdminOrManager && (
            <TabsTrigger value="approvals" className={tabTriggerClass}>
              <ClipboardCheck className="h-3.5 w-3.5" />
              Approbations
            </TabsTrigger>
          )}
          {isAdminOrManager && (
            <TabsTrigger value="time" className={tabTriggerClass}>
              <Activity className="h-3.5 w-3.5" />
              Temps
            </TabsTrigger>
          )}
          {isFreelancer && (
            <TabsTrigger value="deliverables" className={tabTriggerClass}>
              <Upload className="h-3.5 w-3.5" />
              Mes livrables
            </TabsTrigger>
          )}
          {isFreelancer && (
            <TabsTrigger value="my-time" className={tabTriggerClass}>
              <Activity className="h-3.5 w-3.5" />
              Mon temps
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="tasks" className="mt-5">
          <Card className="rounded-2xl border border-border shadow-none">
            <CardContent className="pt-4">
              {displayedTasks.length > 0 ? (
                <>
                  <ul className="divide-y divide-border">
                    {displayedTasks.map((task) => (
                      <li key={task.id} className="flex items-center justify-between py-2.5">
                        <span className="text-sm text-ink">{task.title}</span>
                        <Badge className={`${TASK_STATUS_COLOR[task.status]} text-xs`} variant="secondary">
                          {TASK_STATUS_LABELS[task.status] ?? task.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                  {tasks.length > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3 w-full text-xs gap-1"
                      onClick={() => navigate(`/app/tasks?projectId=${project.id}`)}
                    >
                      Voir toutes les tâches ({tasks.length})
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center py-8 gap-2">
                  <FileText className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">{t("projects.noTasks")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isAdminOrManager && (
          <TabsContent value="approvals" className="mt-5">
            <TabErrorBoundary>
              <ApprovalsPage />
            </TabErrorBoundary>
          </TabsContent>
        )}

        {isAdminOrManager && (
          <TabsContent value="time" className="mt-5">
            <TimeTrackingTab
              projectId={project.id}
              budget={project.budget}
              tasks={tasks.map((t) => ({ id: t.id, title: t.title }))}
            />
          </TabsContent>
        )}

        {isFreelancer && (
          <TabsContent value="deliverables" className="mt-5 space-y-4">
            <Card className="rounded-2xl border border-border shadow-none">
              <CardContent className="pt-5 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Déposez ici vos livrables (fichiers, exports, rapports). Ils seront visibles par votre manager.
                </p>
                <div className="space-y-2">
                  <input
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    placeholder="Nom du livrable"
                    value={deliverableName}
                    onChange={(e) => setDeliverableName(e.target.value)}
                  />
                  <FileUploadField
                    context="document"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
                    label="Choisir un fichier"
                    uploadImmediately={true}
                    onUploaded={(result) => {
                      if (result && "key" in result) {
                        uploadedDeliverable.current = result as UploadResult;
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    disabled={!deliverableName.trim() || isUploadingDeliverable}
                    onClick={() => {
                      if (!uploadedDeliverable.current || !deliverableName.trim()) return;
                      createDocument(
                        {
                          name: deliverableName.trim(),
                          title: deliverableName.trim(),
                          type: "DELIVERABLE",
                          accessLevel: "ADMIN_FREELANCER",
                          url: uploadedDeliverable.current.url,
                          fileUrl: uploadedDeliverable.current.url,
                          fileKey: uploadedDeliverable.current.key,
                          tags: [project.name],
                        },
                        {
                          onSuccess: () => {
                            setDeliverableName("");
                            uploadedDeliverable.current = null;
                            toast.success("Livrable déposé avec succès.");
                          },
                          onError: () => toast.error("Erreur lors du dépôt."),
                        }
                      );
                    }}
                    className="gap-1"
                  >
                    {isUploadingDeliverable ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    Déposer le livrable
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* List existing deliverables for this project */}
            {myDocsResult && myDocsResult.data.filter((d) => d.type === "DELIVERABLE").length > 0 && (
              <Card className="rounded-2xl border border-border shadow-none">
                <CardContent className="pt-4 divide-y divide-border">
                  {myDocsResult.data
                    .filter((d) => d.type === "DELIVERABLE")
                    .map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between py-2.5">
                        <span className="text-sm text-ink truncate pr-4">{doc.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1 shrink-0"
                          onClick={() => window.open(doc.url, "_blank")}
                        >
                          <ExternalLink className="h-3 w-3" />
                          Ouvrir
                        </Button>
                      </div>
                    ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {isFreelancer && (
          <TabsContent value="my-time" className="mt-5">
            <TimeTrackingTab
              projectId={project.id}
              budget={null}
              tasks={tasks.map((task) => ({ id: task.id, title: task.title }))}
              readOnly={false}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Status Change Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changer le statut du projet</DialogTitle>
            <DialogDescription>
              Statut actuel : <strong>{STATUS_LABELS[project.status]}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {validTransitions.map((s) => (
              <button
                key={s}
                onClick={() => setTargetStatus(s)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  targetStatus === s ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                }`}
              >
                <Badge className={STATUS_COLOR[s] ?? "bg-gray-100 text-gray-800"}>
                  {STATUS_LABELS[s]}
                </Badge>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStatusDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleStatusChange} disabled={!targetStatus || isUpdating}>
              {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
