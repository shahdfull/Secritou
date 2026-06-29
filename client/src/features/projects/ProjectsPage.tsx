import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getProjectStatusBadgeClass } from "@/utils/statusColors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { TasksPage } from "@/features/tasks/TasksPage";
import { DocumentsPage } from "@/features/documents/DocumentsPage";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Eye,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
} from "@/hooks/useProjects";
import type { Project } from "@/types/project";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useClients } from "@/hooks/useClients";
import { useListParams } from "@/hooks/useListParams";
import { DataTablePagination } from "@/components/common/DataTablePagination";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "react-i18next";
import { usePermission } from "@/hooks/usePermission";
import { ConfirmDeleteDialog } from "@/components/shared/crud/ConfirmDeleteDialog";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth.store";

const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  // All four statuses are valid: the create dialog only surfaces PLANNING/IN_PROGRESS,
  // but the shared edit form resets from an existing project that may be REVIEW/COMPLETED.
  status: z.enum(["PLANNING", "IN_PROGRESS", "REVIEW", "COMPLETED"]).default("PLANNING"),
  clientId: z.string().min(1, "Un client est requis"),
});

const updateProjectSchema = createProjectSchema.partial();

type CreateProjectForm = z.infer<typeof createProjectSchema>;
type UpdateProjectForm = z.infer<typeof updateProjectSchema>;

function ProjectGrid({
  projects,
  clientById,
  getStatusBadgeClass,
  getStatusLabel,
  t,
  canDelete,
  onEdit,
  onDelete,
}: {
  projects: Project[];
  clientById: Map<string, { id: string; name: string }>;
  getStatusBadgeClass: (status: string) => string;
  getStatusLabel: (status: string) => string;
  t: (key: string) => string;
  canDelete: boolean;
  onEdit: (p: Project) => void;
  onDelete: (p: Project) => void;
}) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">Aucun projet dans cette catégorie.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {projects.map((project) => {
        const client = project.clientId ? clientById.get(project.clientId) : undefined;
        return (
          <Card key={project.id} className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group bg-card">
            <CardHeader>
              <div className="flex items-start justify-between">
                <Link to={`/app/projects/${project.id}`} className="flex-1 min-w-0">
                  <CardTitle className="text-lg group-hover:text-primary transition-colors">{project.name}</CardTitle>
                  {client && <p className="text-sm text-muted-foreground">{client.name}</p>}
                </Link>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                    <Link to={`/app/projects/${project.id}`}>
                      <Eye className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(project)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  {canDelete && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => onDelete(project)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{project.description || t("common.noDescription")}</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeClass(project.status)}`}>
                    {getStatusLabel(project.status)}
                  </span>
                  <span className="text-sm font-medium">{project.progress}%</span>
                </div>
                <Progress value={project.progress} className="h-2 bg-primary-soft [&>div]:bg-primary" />
                <p className="text-[11px] text-muted-foreground">
                  Basé sur les tâches complétées ({project.taskDone}/{project.taskTotal})
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function ProjectsPage() {
  const { t } = useTranslation();
  const currentUser = useAuthStore((s) => s.user);
  const isFreelancer = currentUser?.role === "FREELANCER";
  const canCreate = usePermission("projects", "create");
  const canDelete = usePermission("projects", "delete");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const { page, pageSize, orderBy, orderDir, search, params, setPage, setSearch, updateParams } = useListParams(12);
  const { data: projectsResult, isLoading: projectsLoading } = useProjects({ ...params, search });
  const { data: clientsResult, isLoading: clientsLoading } = useClients({ page: 1, pageSize: 100 });
  const [searchInput, setSearchInput] = useState(search ?? "");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput, setSearch]);

  const projects = projectsResult?.data ?? [];
  const total = projectsResult?.total ?? 0;

  const ACTIVE_STATUSES = ["PLANNING", "IN_PROGRESS", "REVIEW"];
  const activeProjects = useMemo(() => projects.filter((p) => ACTIVE_STATUSES.includes(p.status)), [projects]);
  const doneProjects = useMemo(() => projects.filter((p) => !ACTIVE_STATUSES.includes(p.status)), [projects]);
  const clients = clientsResult?.data ?? [];
  const { mutate: createProject, isPending: isCreating } = useCreateProject();
  const { mutate: updateProject, isPending: isUpdating } = useUpdateProject();
  const { mutate: deleteProject, isPending: isDeleting } = useDeleteProject();

  const clientById = useMemo(() => {
    const map = new Map<string, (typeof clients)[number]>();
    for (const c of clients) map.set(c.id, c);
    return map;
  }, [clients]);

  const filteredProjects = projects;

  const createForm = useForm<CreateProjectForm>({
    resolver: zodResolver(createProjectSchema) as any,
    defaultValues: {
      name: "",
      description: "",
      status: "PLANNING",
      clientId: "",
    },
  });

  const editForm = useForm<UpdateProjectForm>({
    resolver: zodResolver(updateProjectSchema) as any,
  });

  const handleCreate = useCallback(async (data: CreateProjectForm) => {
    createProject(data, {
      onSuccess: () => {
        setCreateDialogOpen(false);
        createForm.reset();
      },
    });
  }, [createForm, createProject]);

  const handleEdit = useCallback((project: Project) => {
    setEditingProject(project);
    editForm.reset({
      ...project,
      clientId: project.clientId || "",
    });
    setEditDialogOpen(true);
  }, [editForm]);

  const handleUpdate = useCallback(async (data: UpdateProjectForm) => {
    if (!editingProject) return;
    updateProject(
      { id: editingProject.id, data },
      {
        onSuccess: () => {
          setEditDialogOpen(false);
          setEditingProject(null);
        },
        onError: (error: any) => {
          const errorCode = error?.response?.data?.error?.code;
          if (errorCode === "COMPLETION_REQUIRES_CLIENT_APPROVAL") {
            toast.error("Ce projet ne peut être complété que via l'approbation du client.");
          } else if (errorCode === "INVALID_STATUS_TRANSITION") {
            toast.error("Transition de statut invalide.");
          } else {
            toast.error("Une erreur est survenue lors de la mise à jour.");
          }
        },
      }
    );
  }, [editingProject, updateProject]);

  const handleDelete = useCallback((project: Project) => {
    setDeleteTarget(project);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteProject(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
      onError: (error: any) => {
        const errorCode = error?.response?.data?.error?.code;
        if (errorCode === "PROJECT_HAS_INVOICES") {
          toast.error("Ce projet a des factures émises et ne peut pas être supprimé. Archivez-le.");
        } else if (errorCode === "PROJECT_HAS_ONBOARDING") {
          toast.error("Ce projet a un onboarding et ne peut pas être supprimé. Archivez-le.");
        } else {
          toast.error("Une erreur est survenue lors de la suppression.");
        }
        setDeleteTarget(null);
      },
    });
  }, [deleteTarget, deleteProject]);

  const getStatusBadgeClass = getProjectStatusBadgeClass;

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "PLANNING":
        return t("projectsPage.statuses.planning");
      case "IN_PROGRESS":
        return t("projectsPage.statuses.inProgress");
      case "REVIEW":
        return t("projectsPage.statuses.review");
      case "COMPLETED":
        return t("projectsPage.statuses.completed");
      default:
        return status;
    }
  };

  if (projectsLoading || clientsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Projets</h1>
          <p className="text-muted-foreground">{t("projectsPage.subtitle")}</p>
        </div>
      </div>
      
      <Tabs defaultValue="projects">
        <TabsList className="bg-primary-soft/30 border border-primary/10">
          <TabsTrigger value="projects">Projets</TabsTrigger>
          <TabsTrigger value="tasks">Tâches</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>
        
        <TabsContent value="projects" className="space-y-6 mt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              {canCreate && (
                <DialogTrigger asChild>
                  <Button className="bg-ink text-white hover:bg-ink/90 rounded-full">
                    <Plus className="h-4 w-4 mr-2" />
                    {t("projectsPage.newProject")}
                  </Button>
                </DialogTrigger>
              )}
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("projectsPage.createProject")}</DialogTitle>
                  <DialogDescription>{t("projectsPage.createProjectDesc")}</DialogDescription>
                </DialogHeader>
                <Form {...createForm}>
                  <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
                    <FormField
                      control={createForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("common.name")}</FormLabel>
                          <FormControl>
                            <Input placeholder={t("projectsPage.name")} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("common.description")}</FormLabel>
                          <FormControl>
                            <Textarea placeholder={t("projectsPage.description")} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("common.status")}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t("projectsPage.selectStatus")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="PLANNING">{t("projectsPage.statuses.planning")}</SelectItem>
                              <SelectItem value="IN_PROGRESS">{t("projectsPage.statuses.inProgress")}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="clientId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("common.client")}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t("projectsPage.selectClient")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {clients?.map((client) => (
                                <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type="submit" disabled={isCreating}>
                        {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {t("common.create")}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search & Sort */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder={t("projectsPage.searchProjects")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={`${orderBy ?? "createdAt"}-${orderDir}`}
              onValueChange={(v) => {
                const [col, dir] = v.split("-") as [string, "asc" | "desc"];
                updateParams({ orderBy: col, orderDir: dir, page: 1 });
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t("common.sortBy")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name-asc">Nom (A-Z)</SelectItem>
                <SelectItem value="name-desc">Nom (Z-A)</SelectItem>
                <SelectItem value="status-asc">Moins avancé en premier</SelectItem>
                <SelectItem value="status-desc">Plus avancé en premier</SelectItem>
                <SelectItem value="createdAt-desc">Plus récents</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Freelancer: active / done sub-tabs */}
          {isFreelancer ? (
            <Tabs defaultValue="active">
              <TabsList className="bg-muted/50 border border-border h-9">
                <TabsTrigger value="active" className="text-xs h-7">
                  En cours
                  {activeProjects.length > 0 && (
                    <span className="ml-1.5 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
                      {activeProjects.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="done" className="text-xs h-7">
                  Terminés
                  {doneProjects.length > 0 && (
                    <span className="ml-1.5 text-[10px] bg-muted-foreground/30 text-muted-foreground rounded-full px-1.5 py-0.5">
                      {doneProjects.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="active" className="mt-4">
                <ProjectGrid projects={activeProjects} clientById={clientById} getStatusBadgeClass={getStatusBadgeClass} getStatusLabel={getStatusLabel} t={t} canDelete={canDelete} onEdit={handleEdit} onDelete={handleDelete} />
              </TabsContent>
              <TabsContent value="done" className="mt-4">
                <ProjectGrid projects={doneProjects} clientById={clientById} getStatusBadgeClass={getStatusBadgeClass} getStatusLabel={getStatusLabel} t={t} canDelete={canDelete} onEdit={handleEdit} onDelete={handleDelete} />
              </TabsContent>
            </Tabs>
          ) : (
            /* Admin/Manager: flat list */
            <ProjectGrid projects={filteredProjects} clientById={clientById} getStatusBadgeClass={getStatusBadgeClass} getStatusLabel={getStatusLabel} t={t} canDelete={canDelete} onEdit={handleEdit} onDelete={handleDelete} />
          )}

          <DataTablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />

          {/* Edit Dialog */}
          {editingProject && (
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("projectsPage.editProject")}</DialogTitle>
                  <DialogDescription>{t("projectsPage.editProjectDesc")}</DialogDescription>
                </DialogHeader>
                <Form {...editForm}>
                  <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
                    <FormField
                      control={editForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("common.name")}</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("common.description")}</FormLabel>
                          <FormControl>
                            <Textarea {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="status"
                      render={({ field }) => {
                        // Define valid options based on current status
                        const validOptions: Record<string, string[]> = {
                          PLANNING: ["PLANNING", "IN_PROGRESS"],
                          IN_PROGRESS: ["PLANNING", "IN_PROGRESS", "REVIEW"],
                          REVIEW: ["IN_PROGRESS", "REVIEW"],
                          COMPLETED: ["COMPLETED"],
                        };
                        const availableStatuses = editingProject ? (validOptions[editingProject.status] || [editingProject.status]) : ["PLANNING", "IN_PROGRESS", "REVIEW", "COMPLETED"];

                        return (
                          <FormItem>
                            <FormLabel>{t("common.status")}</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder={t("projectsPage.selectStatus")} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {availableStatuses.includes("PLANNING") && <SelectItem value="PLANNING">{t("projectsPage.statuses.planning")}</SelectItem>}
                                {availableStatuses.includes("IN_PROGRESS") && <SelectItem value="IN_PROGRESS">{t("projectsPage.statuses.inProgress")}</SelectItem>}
                                {availableStatuses.includes("REVIEW") && <SelectItem value="REVIEW">{t("projectsPage.statuses.review")}</SelectItem>}
                                {availableStatuses.includes("COMPLETED") && <SelectItem value="COMPLETED">{t("projectsPage.statuses.completed")}</SelectItem>}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                    <FormField
                      control={editForm.control}
                      name="clientId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("common.client")}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t("projectsPage.selectClient")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {clients?.map((client) => (
                                <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type="submit" disabled={isUpdating}>
                        {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {t("common.save")}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>
        
        <TabsContent value="tasks">
          <TasksPage />
        </TabsContent>
        
        <TabsContent value="documents">
          <DocumentsPage />
        </TabsContent>
      </Tabs>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={handleConfirmDelete}
        title={`Supprimer "${deleteTarget?.name}" ?`}
        description="Cette action est irréversible. Le projet sera définitivement supprimé."
        isDeleting={isDeleting}
      />
    </div>
  );
}