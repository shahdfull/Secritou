import { Layout, KanbanSquare, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateTask, useUpdateTask, useDeleteTask } from "@/hooks/useTasks";
import type { Task } from "@/types/task";
import { useListParams } from "@/hooks/useListParams";
import { useTranslation } from "react-i18next";
import { TasksKanban } from "./TasksKanban";
import { ConfirmDeleteDialog } from "@/components/shared/crud/ConfirmDeleteDialog";
import { toast } from "sonner";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/store/auth.store";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  createTaskSchema,
  updateTaskSchema,
  type CreateTaskForm,
  type UpdateTaskForm,
} from "@/schemas/task.schema";
import { useDebouncedValue } from "@/hooks/shared/useDebouncedValue";
import { useCrudDialogState } from "@/hooks/shared/useCrudDialogState";
import { TaskCreateDialog } from "./components/TaskCreateDialog";
import { TaskEditDialog } from "./components/TaskEditDialog";
import { TaskDetailDrawer } from "./components/TaskDetailDrawer";
import { TasksListView } from "./components/TasksListView";
import { useTasksPageData } from "./hooks/useTasksPageData";
import { useTaskCommentMutation } from "./hooks/useTaskCommentMutation";

export function TasksPage() {
  const { t } = useTranslation();
  const currentUser = useAuthStore((s) => s.user);
  const canCreateTask = usePermission("tasks", "create");
  const canDeleteTask = usePermission("tasks", "delete");
  const isFreelancer = currentUser?.role === "FREELANCER";
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [isViewTransitionPending, startViewTransition] = useTransition();
  const [searchInput, setSearchInput] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<Task | null>(null);
  const selectedTaskId = selectedTask?.id ?? null;

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

  const { tasks, total, projects, users, comments, projectNameById, userById, isLoading } =
    useTasksPageData(listParams, selectedTaskId);

  const { mutate: createTask, isPending: isCreating } = useCreateTask();
  const { mutate: updateTask, isPending: isUpdating } = useUpdateTask();
  const { mutate: deleteTask, isPending: isDeleting } = useDeleteTask();
  const createCommentMutation = useTaskCommentMutation();

  const {
    createDialogOpen,
    editDialogOpen,
    editingEntity: editingTask,
    closeCreateDialog,
    openEditDialog,
    closeEditDialog,
  } = useCrudDialogState<Task>();

  const createForm = useForm<CreateTaskForm>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "TODO",
      priority: "NORMAL",
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

  const handleDelete = useCallback((task: Task) => {
    setDeleteTaskTarget(task);
  }, []);

  const handleConfirmDeleteTask = useCallback(() => {
    if (!deleteTaskTarget) return;
    deleteTask(deleteTaskTarget.id, {
      onSuccess: () => setDeleteTaskTarget(null),
      onError: () => {
        toast.error("Une erreur est survenue lors de la suppression.");
        setDeleteTaskTarget(null);
      },
    });
  }, [deleteTaskTarget, deleteTask]);

  const handleView = useCallback((task: Task) => {
    setSelectedTask(task);
    setDetailSheetOpen(true);
  }, []);

  const handleAddComment = useCallback(
    (content: string) => {
      if (!selectedTaskId || !content.trim()) return;
      createCommentMutation.mutate({ taskId: selectedTaskId, content });
    },
    [createCommentMutation, selectedTaskId]
  );

  const handleViewModeChange = useCallback((v: string) => {
    if (!v) return;
    startViewTransition(() => setViewMode(v as "list" | "kanban"));
  }, []);

  const handleSort = useCallback(
    (col: string) => {
      setSort(col, orderBy ?? "createdAt", orderDir);
    },
    [orderBy, orderDir, setSort]
  );

  if (isLoading) {
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
          <TaskCreateDialog
            open={createDialogOpen}
            onOpenChange={closeCreateDialog}
            form={createForm}
            projects={projects}
            users={users}
            canCreate={canCreateTask}
            isCreating={isCreating}
            onSubmit={handleCreate}
          />
        </div>
      </div>

      {viewMode === "list" ? (
        <TasksListView
          tasks={tasks}
          projectNameById={projectNameById}
          userById={userById}
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          orderBy={orderBy}
          orderDir={orderDir}
          onSort={handleSort}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          isFreelancer={isFreelancer}
          currentUserId={currentUser?.id}
          canDelete={canDeleteTask}
          onView={handleView}
          onEdit={handleEditTask}
          onDelete={handleDelete}
        />
      ) : (
        <TasksKanban
          filteredTasks={tasks}
          onTaskClick={handleView}
          restrictDragToUserId={isFreelancer ? currentUser?.id : undefined}
        />
      )}

      {editingTask && (
        <TaskEditDialog
          open={editDialogOpen}
          onOpenChange={closeEditDialog}
          form={editForm}
          projects={projects}
          users={users}
          isFreelancer={isFreelancer}
          isUpdating={isUpdating}
          onSubmit={handleUpdate}
        />
      )}

      <TaskDetailDrawer
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        task={selectedTask}
        projectName={selectedTask ? projectNameById.get(selectedTask.projectId) : undefined}
        userById={userById}
        comments={comments ?? []}
        onAddComment={handleAddComment}
        createCommentMutation={createCommentMutation}
      />

      <ConfirmDeleteDialog
        open={!!deleteTaskTarget}
        onOpenChange={(open) => { if (!open) setDeleteTaskTarget(null); }}
        onConfirm={handleConfirmDeleteTask}
        title={`Supprimer "${deleteTaskTarget?.title}" ?`}
        description="Cette action est irréversible. La tâche sera définitivement supprimée."
        isDeleting={isDeleting}
      />
    </div>
  );
}
