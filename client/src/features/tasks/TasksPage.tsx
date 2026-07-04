import { Layout, KanbanSquare, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState, useTransition, useCallback } from "react";
import { useListParams } from "@/hooks/useListParams";
import { useTranslation } from "react-i18next";
import { TasksKanban } from "./TasksKanban";
import { ConfirmDeleteDialog } from "@/components/shared/crud/ConfirmDeleteDialog";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/store/auth.store";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDebouncedValue } from "@/hooks/shared/useDebouncedValue";
import { TaskCreateDialog } from "./components/TaskCreateDialog";
import { TaskEditDialog } from "./components/TaskEditDialog";
import { TaskDetailDrawer } from "./components/TaskDetailDrawer";
import { TasksListView } from "./components/TasksListView";
import { useTasksPageData } from "./hooks/useTasksPageData";
import { useTaskActions } from "./hooks/useTaskActions";

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

  const actions = useTaskActions();
  const { tasks, total, projects, users, comments, projectNameById, userById, isLoading } =
    useTasksPageData(listParams, actions.selectedTaskId);

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
            open={actions.createDialogOpen}
            onOpenChange={actions.closeCreateDialog}
            form={actions.createForm}
            projects={projects}
            users={users}
            canCreate={canCreateTask}
            isCreating={actions.isCreating}
            onSubmit={actions.handleCreate}
          />
        </div>
      </div>

      {viewMode === "list" ? (
        <TasksListView
          tasks={tasks}
          projectNameById={projectNameById}
          userById={userById}
          filters={{
            search: searchInput,
            onSearchChange: setSearchInput,
            status: statusFilter,
            onStatusChange: setStatusFilter,
          }}
          sort={{ orderBy, orderDir, onSort: handleSort }}
          pagination={{ page, pageSize, total, onPageChange: setPage }}
          permissions={{ isFreelancer, currentUserId: currentUser?.id, canDelete: canDeleteTask }}
          actions={{ onView: actions.handleView, onEdit: actions.handleEditTask, onDelete: actions.handleDelete }}
        />
      ) : (
        <TasksKanban
          filteredTasks={tasks}
          onTaskClick={actions.handleView}
          restrictDragToUserId={isFreelancer ? currentUser?.id : undefined}
        />
      )}

      {actions.editingTask && (
        <TaskEditDialog
          open={actions.editDialogOpen}
          onOpenChange={actions.closeEditDialog}
          form={actions.editForm}
          projects={projects}
          users={users}
          isFreelancer={isFreelancer}
          isUpdating={actions.isUpdating}
          onSubmit={actions.handleUpdate}
        />
      )}

      <TaskDetailDrawer
        open={actions.detailSheetOpen}
        onOpenChange={actions.setDetailSheetOpen}
        task={actions.selectedTask}
        projectName={actions.selectedTask ? projectNameById.get(actions.selectedTask.projectId) : undefined}
        userById={userById}
        comments={comments ?? []}
        onAddComment={actions.handleAddComment}
        createCommentMutation={actions.createCommentMutation}
      />

      <ConfirmDeleteDialog
        open={!!actions.deleteTaskTarget}
        onOpenChange={(open) => { if (!open) actions.setDeleteTaskTarget(null); }}
        onConfirm={actions.handleConfirmDeleteTask}
        title={`Supprimer "${actions.deleteTaskTarget?.title}" ?`}
        description="Cette action est irréversible. La tâche sera définitivement supprimée."
        isDeleting={actions.isDeleting}
      />
    </div>
  );
}
