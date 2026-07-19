import { Layout, KanbanSquare, CalendarDays, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState, useTransition, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useListParams } from "@/hooks/useListParams";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { TasksKanban } from "./TasksKanban";
import { ConfirmDeleteDialog } from "@/components/shared/crud/ConfirmDeleteDialog";
import { FreelancerConflictDialog } from "@/components/shared/FreelancerConflictDialog";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/store/auth.store";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDebouncedValue } from "@/hooks/shared/useDebouncedValue";
import { TaskCreateDialog } from "./components/TaskCreateDialog";
import { TaskEditDialog } from "./components/TaskEditDialog";
import { TaskDetailDrawer } from "./components/TaskDetailDrawer";
import { TasksListView } from "./components/TasksListView";
import { TasksCalendar } from "./components/TasksCalendar";
import { useTasksPageData } from "./hooks/useTasksPageData";
import { useTaskActions } from "./hooks/useTaskActions";
import { filterAssignableUsers } from "./taskUtils";

export function TasksPage() {
  const { t } = useTranslation();
  const currentUser = useAuthStore((s) => s.user);
  const canCreateTask = usePermission("tasks", "create");
  const canDeleteTask = usePermission("tasks", "delete");
  const isFreelancer = currentUser?.role === "FREELANCER";
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [isViewTransitionPending, startViewTransition] = useTransition();
  const [searchInput, setSearchInput] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "kanban" | "calendar">("list");

  const { page, pageSize, orderBy, orderDir, search, params, setPage, setSearch, setSort } = useListParams(10);
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  // SEC-052: the "Voir toutes les tâches" link from a project's detail page navigates to
  // /app/tasks?projectId=<id>, but nothing here ever read that query param — the user landed on
  // the full, unfiltered company-wide task list. useTasks()/tasksApi.getAll() already support a
  // projectId argument end to end (server included); it just never reached this page.
  const [searchParams, setSearchParams] = useSearchParams();
  const projectIdFilter = searchParams.get("projectId") ?? undefined;
  const clearProjectFilter = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("projectId");
      return next;
    });
  }, [setSearchParams]);

  // SEC-056 (U1): assignee and "overdue only" filters, persisted in the URL the same way
  // projectId is above — not folded into useListParams, which is shared by every other list page
  // (clients, invoices, ...) and must stay generic.
  const assigneeIdFilter = searchParams.get("assigneeId") ?? undefined;
  const overdueFilter = searchParams.get("overdue") === "true";
  const setAssigneeIdFilter = useCallback(
    (value: string | undefined) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set("assigneeId", value);
        else next.delete("assigneeId");
        return next;
      });
    },
    [setSearchParams]
  );
  const setOverdueFilter = useCallback(
    (value: boolean) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set("overdue", "true");
        else next.delete("overdue");
        return next;
      });
      // Mirrors the server (task.repository.ts#buildWhere): overdue already implies
      // status != DONE, and the two combined would otherwise silently conflict — so the status
      // dropdown is disabled while this is active (see TasksListView) and reset here.
      // statusFilter is separate local state (useState below), not part of the URL.
      if (value) setStatusFilter("All");
    },
    [setSearchParams]
  );

  useEffect(() => {
    setSearch(debouncedSearch);
  }, [debouncedSearch, setSearch]);

  const isUnpaginatedView = viewMode === "kanban" || viewMode === "calendar";
  const listParams = useMemo(
    () => ({
      ...params,
      pageSize: isUnpaginatedView ? 200 : pageSize,
      page: isUnpaginatedView ? 1 : page,
      orderBy: orderBy ?? "createdAt",
      orderDir,
      search,
      status: statusFilter === "All" ? undefined : statusFilter,
    }),
    [params, isUnpaginatedView, pageSize, page, orderBy, orderDir, search, statusFilter]
  );

  const taskFilters = useMemo(
    () => ({ assigneeId: assigneeIdFilter, overdue: overdueFilter }),
    [assigneeIdFilter, overdueFilter]
  );

  const actions = useTaskActions();
  const { tasks, total, projects, projectsTotal, users, comments, projectNameById, userById, isLoading } =
    useTasksPageData(listParams, actions.selectedTaskId, projectIdFilter, taskFilters);

  // SEC-055 (F5): ProjectDetailPage's "+ Nouvelle tâche" button (contextualized, once a project
  // already has tasks) navigates here with ?projectId=<id>&openCreate=true — open the create
  // dialog on arrival, pre-filled, instead of leaving the user to find the project again in the
  // create form's own selector. Consumed once via a query-param removal so it doesn't re-fire on
  // every re-render or re-open after the dialog is closed.
  const openCreateDialogForProject = actions.openCreateDialogForProject;
  const shouldAutoOpenCreate = Boolean(projectIdFilter) && searchParams.get("openCreate") === "true";
  useEffect(() => {
    if (!shouldAutoOpenCreate || !projectIdFilter) return;
    openCreateDialogForProject(projectIdFilter);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("openCreate");
      return next;
    });
  }, [shouldAutoOpenCreate, projectIdFilter, openCreateDialogForProject, setSearchParams]);

  // The assignee selector must not offer a choice the server always refuses; `users` itself stays
  // unfiltered (userById still needs every role to label assignees already on a task).
  const assignableUsers = useMemo(() => filterAssignableUsers(users), [users]);

  const handleViewModeChange = useCallback((v: string) => {
    if (!v) return;
    startViewTransition(() => setViewMode(v as "list" | "kanban" | "calendar"));
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
            <ToggleGroupItem value="calendar" aria-label="Calendar view" disabled={isViewTransitionPending}>
              <CalendarDays className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <TaskCreateDialog
            open={actions.createDialogOpen}
            onOpenChange={actions.closeCreateDialog}
            form={actions.createForm}
            projects={projects}
            users={assignableUsers}
            canCreate={canCreateTask}
            isCreating={actions.isCreating}
            onSubmit={actions.handleCreate}
          />
        </div>
      </div>

      {isFreelancer && (
        <p className="rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
          {t("tasksPage.freelancerScopeNotice", "Vous voyez uniquement vos tâches assignées.")}
        </p>
      )}

      {projectIdFilter && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
          <span>
            {t("tasksPage.filteredByProject")}{" "}
            <strong>{projectNameById.get(projectIdFilter) ?? projectIdFilter}</strong>
          </span>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={clearProjectFilter}>
            <X className="h-3.5 w-3.5" />
            {t("tasksPage.clearProjectFilter")}
          </Button>
        </div>
      )}

      {/* Kanban and calendar views are capped at 200 tasks (a single unpaginated request) — past
          that, tasks beyond the cap were silently missing from the board with no indication. Not
          a real limit yet at this product stage, but flagging it now avoids a silent data loss as
          the agency's task volume grows. */}
      {isUnpaginatedView && total > 200 && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          {t("tasksPage.kanbanTruncatedNotice", { shown: 200, total })}
        </p>
      )}

      {/* SEC-053: the project selector in the create/edit task forms loads a single unpaginated
          page of 100 projects — past that, some active projects silently become unselectable,
          with no indication (mirrors the Kanban notice above for the same class of cap). */}
      {projectsTotal > 100 && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          {t("tasksPage.projectSelectorTruncatedNotice", { shown: 100, total: projectsTotal })}
        </p>
      )}

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
            assigneeId: assigneeIdFilter,
            onAssigneeChange: setAssigneeIdFilter,
            assignableUsers,
            overdue: overdueFilter,
            onOverdueChange: setOverdueFilter,
          }}
          sort={{ orderBy, orderDir, onSort: handleSort }}
          pagination={{ page, pageSize, total, onPageChange: setPage }}
          permissions={{ isFreelancer, currentUserId: currentUser?.id, canDelete: canDeleteTask }}
          actions={{ onView: actions.handleView, onEdit: actions.handleEditTask, onDelete: actions.handleDelete }}
        />
      ) : viewMode === "kanban" ? (
        <TasksKanban
          filteredTasks={tasks}
          onTaskClick={actions.handleView}
          restrictDragToUserId={isFreelancer ? currentUser?.id : undefined}
        />
      ) : (
        <TasksCalendar tasks={tasks} projectNameById={projectNameById} onView={actions.handleView} />
      )}

      {actions.editingTask && (
        <TaskEditDialog
          open={actions.editDialogOpen}
          onOpenChange={actions.closeEditDialog}
          form={actions.editForm}
          projects={projects}
          users={assignableUsers}
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
        projectClientId={actions.selectedTask ? projects.find((p) => p.id === actions.selectedTask!.projectId)?.clientId : undefined}
        userById={userById}
        comments={comments ?? []}
        onAddComment={actions.handleAddComment}
        createCommentMutation={actions.createCommentMutation}
        currentUserId={currentUser?.id}
        isAdmin={currentUser?.role === "ADMIN"}
        canManageAttachments={!isFreelancer}
        mentionableUsers={assignableUsers}
        onUpdateComment={actions.handleUpdateComment}
        onDeleteComment={actions.handleDeleteComment}
        isUpdatingComment={actions.isUpdatingComment}
        isDeletingComment={actions.isDeletingComment}
      />

      <ConfirmDeleteDialog
        open={!!actions.deleteTaskTarget}
        onOpenChange={(open) => { if (!open) actions.setDeleteTaskTarget(null); }}
        onConfirm={actions.handleConfirmDeleteTask}
        title={`Supprimer "${actions.deleteTaskTarget?.title}" ?`}
        description="Cette action est irréversible. La tâche sera définitivement supprimée."
        isDeleting={actions.isDeleting}
      />

      <FreelancerConflictDialog
        open={!!actions.pendingConflicts}
        onOpenChange={(open) => { if (!open) actions.handleCancelConflict(); }}
        conflicts={actions.pendingConflicts ?? []}
        onConfirm={actions.handleConfirmAssignAnyway}
        isConfirming={actions.isConfirmingConflict}
      />
    </div>
  );
}
