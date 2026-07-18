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
import {
  createProjectSchema,
  updateProjectSchema,
  type CreateProjectForm,
  type UpdateProjectForm,
  PROJECT_STATUS_VALID_TRANSITIONS,
} from "@secritou/shared";
import {
  useProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useRestoreProject,
  useProjectTrash,
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
import { useDebouncedValue } from "@/hooks/shared/useDebouncedValue";
import { useCrudDialogState } from "@/hooks/shared/useCrudDialogState";

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
  t: (key: string, options?: any) => string;
  canDelete: boolean;
  onEdit: (p: Project) => void;
  onDelete: (p: Project) => void;
}) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">{t("projectsPage.noProjectsInCategory")}</p>
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
                  {t("projectsPage.basedOnCompletedTasks", { done: project.taskDone, total: project.taskTotal })}
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
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const {
    createDialogOpen,
    editDialogOpen,
    editingEntity: editingProject,
    openCreateDialog,
    closeCreateDialog,
    openEditDialog,
    closeEditDialog,
  } = useCrudDialogState<Project>();

  const { page, pageSize, orderBy, orderDir, search, params, setPage, setSearch, updateParams } = useListParams(12);
  // Freelancer sub-tabs (Active/Done) are each their own independently paginated request — never
  // derived by filtering a single loaded page client-side, which silently hid projects beyond
  // that page's 12 items while the pagination control at the bottom still showed the true,
  // unfiltered total. Not used for the ADMIN/MANAGER flat list below.
  const [activePage, setActivePage] = useState(1);
  const [donePage, setDonePage] = useState(1);
  const FREELANCER_SUBTAB_PAGE_SIZE = 12;
  const { data: activeProjectsResult, isLoading: activeProjectsLoading } = useProjects({
    page: activePage,
    pageSize: FREELANCER_SUBTAB_PAGE_SIZE,
    statusIn: "PLANNING,IN_PROGRESS,REVIEW",
  });
  const { data: doneProjectsResult, isLoading: doneProjectsLoading } = useProjects({
    page: donePage,
    pageSize: FREELANCER_SUBTAB_PAGE_SIZE,
    statusIn: "COMPLETED",
  });
  const { data: projectsResult, isLoading: projectsLoading } = useProjects({ ...params, search });
  const { data: clientsResult, isLoading: clientsLoading } = useClients({ page: 1, pageSize: 100 });
  const [searchInput, setSearchInput] = useState(search ?? "");
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  useEffect(() => {
    setSearch(debouncedSearch);
  }, [debouncedSearch, setSearch]);

  const projects = projectsResult?.data ?? [];
  const total = projectsResult?.total ?? 0;

  const activeProjects = activeProjectsResult?.data ?? [];
  const activeTotal = activeProjectsResult?.total ?? 0;
  const doneProjects = doneProjectsResult?.data ?? [];
  const doneTotal = doneProjectsResult?.total ?? 0;
  const clients = clientsResult?.data ?? [];
  const { mutate: createProject, isPending: isCreating } = useCreateProject();
  const { mutate: updateProject, isPending: isUpdating } = useUpdateProject();
  const { mutate: deleteProject, isPending: isDeleting } = useDeleteProject();
  const { mutate: restoreProject, isPending: isRestoring } = useRestoreProject();
  const { data: trashResult, isLoading: trashLoading } = useProjectTrash({ ...params, search });

  const clientById = useMemo(() => {
    const map = new Map<string, (typeof clients)[number]>();
    for (const c of clients) map.set(c.id, c);
    return map;
  }, [clients]);

  const filteredProjects = projects;
  const trashedProjects = trashResult?.data ?? [];

  const createForm = useForm<CreateProjectForm>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: "",
      description: "",
      status: "PLANNING",
      clientId: "",
    },
  });

  const editForm = useForm<UpdateProjectForm>({
    resolver: zodResolver(updateProjectSchema),
  });

  const handleCreate = useCallback(async (data: CreateProjectForm) => {
    createProject(data, {
      onSuccess: () => {
        closeCreateDialog();
        createForm.reset();
      },
    });
  }, [createForm, createProject, closeCreateDialog]);

  const handleEdit = useCallback((project: Project) => {
    openEditDialog(project);
    editForm.reset({
      ...project,
      clientId: project.clientId || "",
    });
  }, [editForm, openEditDialog]);

  const handleUpdate = useCallback(async (data: UpdateProjectForm) => {
    if (!editingProject) return;
    updateProject(
      { id: editingProject.id, data },
      {
        onSuccess: () => {
          closeEditDialog();
        },
        onError: (error: any) => {
          const errorCode = error?.response?.data?.error?.code;
          if (errorCode === "COMPLETION_REQUIRES_CLIENT_APPROVAL") {
            toast.error(t("projectsPage.projectCompletionRequiresApproval"));
          } else if (errorCode === "INVALID_STATUS_TRANSITION") {
            toast.error(t("projectsPage.invalidStatusTransition"));
          } else {
            toast.error(t("projectsPage.errorUpdatingProject"));
          }
        },
      }
    );
  }, [editingProject, updateProject, closeEditDialog, t]);

  const handleDelete = useCallback((project: Project) => {
    setDeleteTarget(project);
  }, []);

  const handleRestore = useCallback((project: Project) => {
    restoreProject(project.id);
  }, [restoreProject]);

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteProject(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
      onError: (error: any) => {
        const errorCode = error?.response?.data?.error?.code;
        if (errorCode === "PROJECT_HAS_INVOICES") {
          toast.error(t("projectsPage.projectHasInvoices"));
        } else if (errorCode === "PROJECT_HAS_ONBOARDING") {
          toast.error(t("projectsPage.projectHasOnboarding"));
        } else {
          toast.error(t("projectsPage.errorDeletingProject"));
        }
        setDeleteTarget(null);
      },
    });
  }, [deleteTarget, deleteProject, t]);

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
          <h1 className="font-display text-2xl font-bold text-ink">{t("projectsPage.title")}</h1>
          <p className="text-muted-foreground">{t("projectsPage.subtitle")}</p>
        </div>
      </div>
      
      <Tabs defaultValue="projects">
        <TabsList className="bg-primary-soft/30 border border-primary/10">
          <TabsTrigger value="projects">{t("projectsPage.tabs.projects")}</TabsTrigger>
          <TabsTrigger value="tasks">{t("projectsPage.tabs.tasks")}</TabsTrigger>
          <TabsTrigger value="documents">{t("projectsPage.tabs.documents")}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="projects" className="space-y-6 mt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <Dialog open={createDialogOpen} onOpenChange={(open) => (open ? openCreateDialog() : closeCreateDialog())}>
              {canCreate && (
                <DialogTrigger asChild>
                  <Button className="bg-ink text-white hover:bg-ink/90 rounded-full" onClick={openCreateDialog}>
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
                <SelectItem value="name-asc">{t("common.sort.nameAsc")}</SelectItem>
                <SelectItem value="name-desc">{t("common.sort.nameDesc")}</SelectItem>
                <SelectItem value="status-asc">{t("projectsPage.sort.leastAdvancedFirst")}</SelectItem>
                <SelectItem value="status-desc">{t("projectsPage.sort.mostAdvancedFirst")}</SelectItem>
                <SelectItem value="createdAt-desc">{t("common.sort.mostRecent")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Freelancer: active / done sub-tabs — each its own independently paginated request */}
          {isFreelancer ? (
            <Tabs defaultValue="active">
              <TabsList className="bg-muted/50 border border-border h-9">
                <TabsTrigger value="active" className="text-xs h-7">
                  {t("projectsPage.subtabs.active")}
                  {activeTotal > 0 && (
                    <span className="ml-1.5 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
                      {activeTotal}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="done" className="text-xs h-7">
                  {t("projectsPage.subtabs.done")}
                  {doneTotal > 0 && (
                    <span className="ml-1.5 text-[10px] bg-muted-foreground/30 text-muted-foreground rounded-full px-1.5 py-0.5">
                      {doneTotal}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="active" className="mt-4 space-y-4">
                {activeProjectsLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : (
                  <>
                    <ProjectGrid projects={activeProjects} clientById={clientById} getStatusBadgeClass={getStatusBadgeClass} getStatusLabel={getStatusLabel} t={t} canDelete={canDelete} onEdit={handleEdit} onDelete={handleDelete} />
                    <DataTablePagination page={activePage} pageSize={FREELANCER_SUBTAB_PAGE_SIZE} total={activeTotal} onPageChange={setActivePage} />
                  </>
                )}
              </TabsContent>
              <TabsContent value="done" className="mt-4 space-y-4">
                {doneProjectsLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : (
                  <>
                    <ProjectGrid projects={doneProjects} clientById={clientById} getStatusBadgeClass={getStatusBadgeClass} getStatusLabel={getStatusLabel} t={t} canDelete={canDelete} onEdit={handleEdit} onDelete={handleDelete} />
                    <DataTablePagination page={donePage} pageSize={FREELANCER_SUBTAB_PAGE_SIZE} total={doneTotal} onPageChange={setDonePage} />
                  </>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            /* Admin/Manager: flat list */
            <ProjectGrid projects={filteredProjects} clientById={clientById} getStatusBadgeClass={getStatusBadgeClass} getStatusLabel={getStatusLabel} t={t} canDelete={canDelete} onEdit={handleEdit} onDelete={handleDelete} />
          )}

          <div className="space-y-4 rounded-xl border border-dashed p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">{t("common.trash")}</h2>
                <p className="text-sm text-muted-foreground">{t("projectsPage.trashDesc")}</p>
              </div>
            </div>
            {trashLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : trashedProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("projectsPage.trashEmpty")}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {trashedProjects.map((project) => (
                  <Card key={project.id} className="border-dashed">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg">{project.name}</CardTitle>
                        <Button variant="secondary" size="sm" onClick={() => handleRestore(project)} disabled={isRestoring}>
                          {t("common.restore")}
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {!isFreelancer && (
            <DataTablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
          )}

          {/* Edit Dialog */}
          {editingProject && (
            <Dialog open={editDialogOpen} onOpenChange={closeEditDialog}>
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
                        const availableStatuses = editingProject 
                          ? ([editingProject.status, ...(PROJECT_STATUS_VALID_TRANSITIONS[editingProject.status as keyof typeof PROJECT_STATUS_VALID_TRANSITIONS] || [])] as const)
                          : ["PLANNING", "IN_PROGRESS", "REVIEW", "COMPLETED"];

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
        title={`${t("projectsPage.deleteProjectTitle")} "${deleteTarget?.name}" ?`}
        description={t("projectsPage.deleteProjectDesc")}
        isDeleting={isDeleting}
      />
    </div>
  );
}
