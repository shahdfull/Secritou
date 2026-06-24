import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Layout, KanbanSquare, Plus, UserCheck, MoreHorizontal } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask } from "@/hooks/useTasks";
import type { Task } from "@/types/task";
import { useProjects } from "@/hooks/useProjects";
import { useListParams } from "@/hooks/useListParams";
import { DataTablePagination } from "@/components/common/DataTablePagination";
import { SortableTableHead } from "@/components/common/SortableTableHead";
import { useTranslation } from "react-i18next";
import { TasksKanban } from "./TasksKanban";
import { usersApi } from "@/api/users.api";
import { commentsApi } from "@/api/comments.api";
import type { User } from "@/types/auth";
import type { Comment } from "@/types/comment";
import { format, isPast, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useAuthStore } from "@/store/auth.store";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Edit, Trash2, Eye, Send, Loader2 } from "lucide-react";
import {
  createTaskSchema,
  updateTaskSchema,
  commentFormSchema,
  type CreateTaskForm,
  type UpdateTaskForm,
  type CommentForm,
} from "@/schemas/task.schema";
import { useDebouncedValue } from "@/hooks/shared/useDebouncedValue";
import { useCrudDialogState } from "@/hooks/shared/useCrudDialogState";

const CommentForm = memo(function CommentForm({
  onCreateComment,
  createCommentMutation,
}: {
  onCreateComment: (content: string) => void;
  createCommentMutation: { isPending: boolean };
}) {
  const { t } = useTranslation();
  const commentForm = useForm<CommentForm>({
    resolver: zodResolver(commentFormSchema),
    defaultValues: { content: "" },
  });

  const onSubmit = useCallback(
    (data: CommentForm) => {
      onCreateComment(data.content);
      commentForm.reset();
    },
    [commentForm, onCreateComment]
  );

  return (
    <Form {...commentForm}>
      <form onSubmit={commentForm.handleSubmit(onSubmit)} className="flex gap-2">
        <FormField
          control={commentForm.control}
          name="content"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormControl>
                <Textarea
                  placeholder={t("common.writeComment")}
                  className="flex-1"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={commentForm.formState.isSubmitting || createCommentMutation.isPending}>
          {createCommentMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </Form>
  );
});

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const STATUS_OPTIONS: Task["status"][] = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"];

export function TasksPage() {
  const { t } = useTranslation();
  const currentUser = useAuthStore((s) => s.user);
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [isViewTransitionPending, startViewTransition] = useTransition();
  const [searchInput, setSearchInput] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const selectedTaskId = selectedTask?.id ?? null;
  const queryClient = useQueryClient();

  const { page, pageSize, orderBy, orderDir, search, params, setPage, setSearch, setSort } = useListParams(10);
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  useEffect(() => {
    setSearch(debouncedSearch);
  }, [debouncedSearch, setSearch]);

  const listParams = useMemo(
    () => ({
      ...params,
      pageSize: viewMode === "kanban" ? 200 : pageSize,
      page: viewMode === "kanban" ? 1 : page,
      orderBy: orderBy ?? "createdAt",
      orderDir,
      search,
      status: statusFilter === "All" ? undefined : statusFilter,
    }),
    [params, viewMode, pageSize, page, orderBy, orderDir, search, statusFilter]
  );

  const { data: tasksResult, isLoading: tasksLoading } = useTasks(listParams);
  const { data: projectsResult, isLoading: projectsLoading } = useProjects({ page: 1, pageSize: 100 });
  const tasks = useMemo(() => tasksResult?.data ?? [], [tasksResult?.data]);
  const total = tasksResult?.total ?? 0;
  const projects = useMemo(() => projectsResult?.data ?? [], [projectsResult?.data]);
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["companyUsers"],
    queryFn: async () => {
      const result = await usersApi.getUsers();
      return result.data;
    },
    staleTime: 5 * 60 * 1000,
  });
  const { data: comments } = useQuery<Comment[]>({
    queryKey: ["taskComments", selectedTaskId],
    queryFn: async () => {
      if (!selectedTaskId) return [];
      return commentsApi.getByTaskId(selectedTaskId);
    },
    enabled: !!selectedTaskId,
    staleTime: 15 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  const { mutate: createTask, isPending: isCreating } = useCreateTask();
  const { mutate: updateTask, isPending: isUpdating } = useUpdateTask();
  const { mutate: deleteTask, isPending: isDeleting } = useDeleteTask();
  const createCommentMutation = useMutation({
    mutationFn: (data: { taskId: string; content: string }) => commentsApi.create(data.taskId, { content: data.content }),
    onMutate: async (vars: { taskId: string; content: string }) => {
      await queryClient.cancelQueries({ queryKey: ["taskComments", vars.taskId] });
      const previous = queryClient.getQueryData<Comment[]>(["taskComments", vars.taskId]) ?? [];

      const optimistic: Comment = {
        id: `optimistic-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        content: vars.content,
        createdAt: new Date().toISOString(),
        taskId: vars.taskId,
        authorId: currentUser?.id ?? "me",
        author:
          currentUser ??
          ({
            id: "me",
            email: "me@local",
            name: "You",
            role: "ADMIN",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as User),
      };

      queryClient.setQueryData<Comment[]>(["taskComments", vars.taskId], [optimistic, ...previous]);
      return { previous, taskId: vars.taskId };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      queryClient.setQueryData(["taskComments", ctx.taskId], ctx.previous);
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: ["taskComments", vars.taskId] });
    },
  });

  const {
    createDialogOpen,
    editDialogOpen,
    editingEntity: editingTask,
    openCreateDialog,
    closeCreateDialog,
    openEditDialog,
    closeEditDialog,
  } = useCrudDialogState<Task>();

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) map.set(p.id, p.name);
    return map;
  }, [projects]);

  const userById = useMemo(() => {
    const map = new Map<string, User>();
    for (const u of users ?? []) map.set(u.id, u);
    return map;
  }, [users]);

  const filteredTasks = tasks;

  const createForm = useForm<CreateTaskForm>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "TODO",
      projectId: "",
      dueDate: "",
    },
  });

  const editForm = useForm<UpdateTaskForm>({
    resolver: zodResolver(updateTaskSchema),
  });

  const handleCreate = useCallback(
    (data: CreateTaskForm) => {
      createTask(data, {
        onSuccess: () => {
          closeCreateDialog();
          createForm.reset();
        },
      });
    },
    [createForm, createTask, closeCreateDialog]
  );

  const handleEditTask = useCallback(
    (task: Task) => {
      openEditDialog(task);
      editForm.reset({
        ...task,
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "",
      });
    },
    [editForm, openEditDialog]
  );

  const handleUpdate = useCallback(
    (data: UpdateTaskForm) => {
      if (!editingTask) return;
      updateTask(
        { id: editingTask.id, data },
        {
          onSuccess: () => {
            closeEditDialog();
          },
        }
      );
    },
    [editingTask, updateTask, closeEditDialog]
  );

  const handleDelete = useCallback(
    (task: Task) => {
      if (confirm(`Are you sure you want to delete "${task.title}"?`)) {
        deleteTask(task.id);
      }
    },
    [deleteTask]
  );

  const handleView = useCallback((task: Task) => {
    setSelectedTask(task);
    setDetailSheetOpen(true);
  }, []);

  const handleAddComment = useCallback(
    (content: string) => {
      if (!selectedTaskId || !content.trim()) return;
      createCommentMutation.mutate({
        taskId: selectedTaskId,
        content,
      });
    },
    [createCommentMutation, selectedTaskId]
  );

  const handleViewModeChange = useCallback(
    (v: string) => {
      if (!v) return;
      startViewTransition(() => setViewMode(v as "list" | "kanban"));
    },
    []
  );

  const handleSort = useCallback(
    (col: string) => {
      setSort(col, orderBy ?? "createdAt", orderDir);
    },
    [orderBy, orderDir, setSort]
  );

  const tableScrollElementRef = useRef<HTMLDivElement>(null);
  const tableVirtualizer = useVirtualizer({
    count: filteredTasks.length,
    getScrollElement: () => tableScrollElementRef.current,
    estimateSize: () => 56,
    overscan: 12,
  });

  const commentsScrollRef = useRef<HTMLDivElement | null>(null);
  const commentsList = comments ?? [];
  const commentsVirtualizer = useVirtualizer({
    count: commentsList.length,
    getScrollElement: () => commentsScrollRef.current,
    estimateSize: () => 84,
    overscan: 8,
  });

  const getStatusBadgeClass = (status: Task["status"]) => {
    switch (status) {
      case "TODO":
        return "bg-gray-100 text-gray-800";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800";
      case "REVIEW":
        return "bg-yellow-100 text-yellow-800";
      case "DONE":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: Task["status"]) => {
    switch (status) {
      case "TODO":
        return t("tasksPage.statuses.todo");
      case "IN_PROGRESS":
        return t("tasksPage.statuses.inProgress");
      case "REVIEW":
        return t("tasksPage.statuses.review");
      case "DONE":
        return t("tasksPage.statuses.done");
      default:
        return status;
    }
  };

  if (tasksLoading || projectsLoading || usersLoading) {
    return (
      <div className="flex items-center justify-center min-h-[65vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">{t("tasksPage.title")}</h1>
          <p className="text-muted-foreground">{t("tasksPage.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <ToggleGroup type="single" value={viewMode} onValueChange={handleViewModeChange}>
            <ToggleGroupItem value="list" aria-label="List view" disabled={isViewTransitionPending}>
              <Layout className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="kanban" aria-label="Kanban view" disabled={isViewTransitionPending}>
              <KanbanSquare className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <Dialog open={createDialogOpen} onOpenChange={closeCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t("tasksPage.newTask")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("tasksPage.createTask")}</DialogTitle>
                <DialogDescription>{t("tasksPage.createTaskDesc")}</DialogDescription>
              </DialogHeader>
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
                  <FormField
                    control={createForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("common.title")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("tasksPage.title")} {...field} />
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
                          <Textarea placeholder={t("tasksPage.description")} {...field} />
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
                              <SelectValue placeholder={t("tasksPage.selectStatus")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {STATUS_OPTIONS.map((status) => (
                              <SelectItem key={status} value={status}>
                                {getStatusLabel(status)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="projectId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("common.project")}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("tasksPage.selectProject")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {projects?.map((project) => (
                              <SelectItem key={project.id} value={project.id}>
                                {project.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="assigneeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assigné à</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("common.selectUser")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {users?.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6 text-xs">
                                    <span>{getInitials(user.name)}</span>
                                  </Avatar>
                                  {user.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("common.dueDate")}</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
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
      </div>

      {viewMode === "list" ? (
        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1 flex items-center gap-2">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder={t("tasksPage.searchTasks")}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t("tasksPage.filterByStatus")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">{t("tasksPage.allStatuses")}</SelectItem>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {getStatusLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    column="title"
                    label={t("common.title")}
                    sortBy={orderBy ?? "createdAt"}
                    sortOrder={orderDir}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    column="project"
                    label={t("common.project")}
                    sortBy={orderBy ?? "createdAt"}
                    sortOrder={orderDir}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    column="status"
                    label={t("common.status")}
                    sortBy={orderBy ?? "createdAt"}
                    sortOrder={orderDir}
                    onSort={handleSort}
                  />
                  <TableHead>Assigné à</TableHead>
                  <SortableTableHead
                    column="dueDate"
                    label={t("common.dueDate")}
                    sortBy={orderBy ?? "createdAt"}
                    sortOrder={orderDir}
                    onSort={handleSort}
                  />
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
            </Table>
            <div
              ref={tableScrollElementRef}
              className="max-h-[65vh] overflow-auto border-t"
              style={{ contentVisibility: "auto" } as React.CSSProperties}
            >
              <div style={{ height: tableVirtualizer.getTotalSize(), position: "relative" }}>
                {tableVirtualizer.getVirtualItems().map((virtualRow) => {
                  const task = filteredTasks[virtualRow.index];
                  if (!task) return null;

                  const projectName = projectNameById.get(task.projectId);
                  const assignee = task.assigneeId ? userById.get(task.assigneeId) : undefined;
                  const dueDateColor = task.dueDate && isPast(new Date(task.dueDate)) ? "text-red-600 font-medium" : "";

                  return (
                    <div
                      key={task.id}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: virtualRow.size,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <div className="border-b">
                        <div className="grid grid-cols-[minmax(220px,2fr)_minmax(180px,1.2fr)_140px_220px_160px_90px] items-center gap-0 px-4 h-14">
                          <div className="font-medium truncate pr-4">{task.title}</div>
                          <div className="truncate pr-4">{projectName ?? "-"}</div>
                          <div>
                            <Badge className={getStatusBadgeClass(task.status)}>
                              {getStatusLabel(task.status)}
                            </Badge>
                          </div>
                          <div>
                            {assignee ? (
                              <div className="flex items-center gap-2 min-w-0">
                                <Avatar className="h-6 w-6 text-xs shrink-0">
                                  <span>{getInitials(assignee.name)}</span>
                                </Avatar>
                                <span className="text-sm truncate">{assignee.name}</span>
                              </div>
                            ) : (
                              "-"
                            )}
                          </div>
                          <div className={dueDateColor}>
                            {task.dueDate ? format(new Date(task.dueDate), "dd MMM yyyy") : "-"}
                          </div>
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleView(task)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Voir
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEditTask(task)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  {t("common.edit")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDelete(task)}
                                  disabled={isDeleting}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {t("common.delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <DataTablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
          </CardContent>
        </Card>
      ) : (
        <TasksKanban filteredTasks={filteredTasks} onTaskClick={handleView} />
      )}

      {/* Edit Dialog */}
      {editingTask && (
        <Dialog open={editDialogOpen} onOpenChange={closeEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("tasksPage.editTask")}</DialogTitle>
              <DialogDescription>{t("tasksPage.editTaskDesc")}</DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
                {currentUser?.role !== "FREELANCER" && (
                  <>
                    <FormField
                      control={editForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("common.title")}</FormLabel>
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
                  </>
                )}
                <FormField
                  control={editForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("common.status")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("tasksPage.selectStatus")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {STATUS_OPTIONS.map((status) => (
                            <SelectItem key={status} value={status}>
                              {getStatusLabel(status)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {currentUser?.role !== "FREELANCER" && (
                  <>
                    <FormField
                      control={editForm.control}
                      name="projectId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("common.project")}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t("tasksPage.selectProject")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {projects?.map((project) => (
                                <SelectItem key={project.id} value={project.id}>
                                  {project.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="assigneeId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assigné à</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t("common.selectUser")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {users?.map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6 text-xs">
                                      <span>{getInitials(user.name)}</span>
                                    </Avatar>
                                    {user.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("common.dueDate")}</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
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

      {/* Task Detail Sheet */}
      {selectedTask && (
        <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
          <SheetContent className="w-full sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>{selectedTask.title}</SheetTitle>
              <SheetDescription>
                {selectedTask.description ?? "Pas de description"}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Statut</p>
                  <Badge className={getStatusBadgeClass(selectedTask.status)}>
                    {getStatusLabel(selectedTask.status)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Projet</p>
                  <p>{projectNameById.get(selectedTask.projectId) ?? "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Assigné à</p>
                  {(() => {
                    const assignee = selectedTask.assigneeId ? userById.get(selectedTask.assigneeId) : undefined;
                    if (assignee) {
                      return (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6 text-xs">
                            <span>{getInitials(assignee.name)}</span>
                          </Avatar>
                          <span className="text-sm">{assignee.name}</span>
                        </div>
                      );
                    }
                    return "-";
                  })()}
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Date d'échéance</p>
                  {selectedTask.dueDate ? (
                    <p className={isPast(new Date(selectedTask.dueDate)) ? "text-red-600 font-medium" : ""}>
                      {format(new Date(selectedTask.dueDate), "dd MMM yyyy")}
                    </p>
                  ) : (
                    "-"
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Commentaires</h3>
                <ScrollArea className="h-80 border rounded-lg p-0">
                  <div ref={commentsScrollRef} className="h-80 overflow-auto p-4">
                    {commentsList.length > 0 ? (
                      <div style={{ height: commentsVirtualizer.getTotalSize(), position: "relative" }}>
                        {commentsVirtualizer.getVirtualItems().map((virtualRow) => {
                          const comment = commentsList[virtualRow.index];
                          if (!comment) return null;
                          return (
                            <div
                              key={comment.id}
                              style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                transform: `translateY(${virtualRow.start}px)`,
                              }}
                            >
                              <div className="flex gap-3 py-2">
                                <Avatar className="h-8 w-8 text-xs">
                                  <span>{getInitials(comment.author.name)}</span>
                                </Avatar>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">{comment.author.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {formatDistanceToNow(new Date(comment.createdAt), {
                                        addSuffix: true,
                                        locale: fr,
                                      })}
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">{comment.content}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-6">Aucun commentaire</p>
                    )}
                  </div>
                </ScrollArea>
                <CommentForm
                  onCreateComment={handleAddComment}
                  createCommentMutation={createCommentMutation}
                />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
