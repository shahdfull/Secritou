import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  MoreHorizontal,
  Search,
  Plus,
  Edit,
  Trash2,
  Loader2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useClients } from "@/hooks/useClients";
import { useListParams } from "@/hooks/useListParams";
import { DataTablePagination } from "@/components/common/DataTablePagination";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "react-i18next";
import { usePermission } from "@/hooks/usePermission";

const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  status: z.enum(["PLANNING", "IN_PROGRESS", "REVIEW", "COMPLETED"]).default("PLANNING"),
  clientId: z.string().optional(),
});

const updateProjectSchema = createProjectSchema.partial();

type CreateProjectForm = z.infer<typeof createProjectSchema>;
type UpdateProjectForm = z.infer<typeof updateProjectSchema>;

export function ProjectsPage() {
  const { t } = useTranslation();
  const canCreate = usePermission("projects", "create");
  const canDelete = usePermission("projects", "delete");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

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
            alert("Project can only be completed via client approval.");
          } else if (errorCode === "INVALID_STATUS_TRANSITION") {
            alert("Invalid status transition.");
          }
        },
      }
    );
  }, [editingProject, updateProject]);

  const handleDelete = useCallback((project: Project) => {
    if (confirm(`Are you sure you want to delete ${project.name}?`)) {
      deleteProject(project.id, {
        onError: (error: any) => {
          const errorCode = error?.response?.data?.error?.code;
          if (errorCode === "PROJECT_HAS_INVOICES") {
            alert("Project has issued invoices and cannot be deleted; archive it instead.");
          } else if (errorCode === "PROJECT_HAS_ONBOARDING") {
            alert("Project has an onboarding record and cannot be deleted; archive it instead.");
          }
        },
      });
    }
  }, [deleteProject]);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "PLANNING":
        return "bg-gray-100 text-gray-800";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800";
      case "REVIEW":
        return "bg-yellow-100 text-yellow-800";
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

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
        <TabsList>
          <TabsTrigger value="projects">Projets</TabsTrigger>
          <TabsTrigger value="tasks">Tâches</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>
        
        <TabsContent value="projects" className="space-y-6 mt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              {canCreate && (
                <DialogTrigger asChild>
                  <Button>
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
                              <SelectItem value="REVIEW">{t("projectsPage.statuses.review")}</SelectItem>
                              <SelectItem value="COMPLETED">{t("projectsPage.statuses.completed")}</SelectItem>
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
                <SelectItem value="status-asc">Statut (A-Z)</SelectItem>
                <SelectItem value="createdAt-desc">Plus récents</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Projects Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProjects.map((project) => {
              const client = project.clientId ? clientById.get(project.clientId) : undefined;

              return (
                <Card key={project.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{project.name}</CardTitle>
                        {client && <p className="text-sm text-muted-foreground">{client.name}</p>}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(project)}>
                            <Edit className="h-4 w-4 mr-2" />
                            {t("common.edit")}
                          </DropdownMenuItem>
                          {canDelete && (
                            <DropdownMenuItem onClick={() => handleDelete(project)} disabled={isDeleting} className="text-red-600">
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t("common.delete")}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{project.description || t("common.noDescription")}</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeClass(project.status)}`}
                        >
                          {getStatusLabel(project.status)}
                        </span>
                        <span className="text-sm font-medium">{project.progress}%</span>
                      </div>
                      <Progress value={project.progress} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

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
    </div>
  );
}
