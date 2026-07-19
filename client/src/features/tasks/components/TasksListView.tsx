import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { format, isPast } from "date-fns";
import { useVirtualizer } from "@tanstack/react-virtual";
import { getTaskStatusBadgeClass } from "@/utils/statusColors";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTablePagination } from "@/components/common/DataTablePagination";
import { SortableTableHead } from "@/components/common/SortableTableHead";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ConfirmDeleteDialog } from "@/components/shared/crud/ConfirmDeleteDialog";
import { Search, Edit, Trash2, Eye, X } from "lucide-react";
import { toast } from "sonner";
import type { Task, TaskStatus } from "@/types/task";
import type { User } from "@/types/auth";
import { useBulkUpdateTaskStatus, useBulkDeleteTasks } from "@/hooks/useTasks";
import { getInitials, getStatusLabel, STATUS_OPTIONS, PRIORITY_BADGE } from "../taskUtils";

const UNASSIGNED_FILTER_VALUE = "__all__";

export interface TasksFilters {
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  // SEC-056 (U1): assignee and "overdue only" filters, combinable with status/search.
  assigneeId: string | undefined;
  onAssigneeChange: (value: string | undefined) => void;
  assignableUsers: User[];
  overdue: boolean;
  onOverdueChange: (value: boolean) => void;
}

export interface TasksSort {
  orderBy: string | undefined;
  orderDir: "asc" | "desc";
  onSort: (col: string) => void;
}

export interface TasksPagination {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export interface TaskRowPermissions {
  isFreelancer: boolean;
  currentUserId: string | undefined;
  canDelete: boolean;
}

export interface TaskRowActions {
  onView: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

interface TasksListViewProps {
  tasks: Task[];
  projectNameById: Map<string, string>;
  userById: Map<string, User>;
  filters: TasksFilters;
  sort: TasksSort;
  pagination: TasksPagination;
  permissions: TaskRowPermissions;
  actions: TaskRowActions;
}

export function TasksListView({
  tasks,
  projectNameById,
  userById,
  filters,
  sort,
  pagination,
  permissions,
  actions,
}: TasksListViewProps) {
  const { t } = useTranslation();
  const {
    search: searchInput,
    onSearchChange,
    status: statusFilter,
    onStatusChange: onStatusFilterChange,
    assigneeId: assigneeFilter,
    onAssigneeChange,
    assignableUsers,
    overdue: overdueFilter,
    onOverdueChange,
  } = filters;
  const { orderBy, orderDir, onSort } = sort;
  const { page, pageSize, total, onPageChange } = pagination;
  const { isFreelancer, currentUserId, canDelete } = permissions;
  const { onView, onEdit, onDelete } = actions;
  const tableScrollElementRef = useRef<HTMLDivElement>(null);
  const tableVirtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => tableScrollElementRef.current,
    estimateSize: () => 56,
    overscan: 12,
  });

  // SEC-060 (actions en masse) : réservées à ADMIN/MANAGER — mêmes routes serveur
  // (authorize("ADMIN","MANAGER") sur /tasks/bulk/*) qu'un FREELANCER ne peut de toute façon pas
  // atteindre ; la case à cocher de sélection n'est donc affichée que si `!isFreelancer`.
  const canBulkAct = !isFreelancer;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const bulkUpdateStatusMutation = useBulkUpdateTaskStatus();
  const bulkDeleteMutation = useBulkDeleteTasks();

  const toggleSelected = (taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const allOnPageSelected = tasks.length > 0 && tasks.every((t) => selectedIds.has(t.id));
  const toggleSelectAllOnPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const t of tasks) {
        if (checked) next.add(t.id);
        else next.delete(t.id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const reportBulkResult = (results: { id: string; success: boolean }[], successMessage: string) => {
    const failures = results.filter((r) => !r.success);
    if (failures.length === 0) {
      toast.success(successMessage);
    } else {
      toast.error(`${results.length - failures.length}/${results.length} réussies — ${failures.length} échec(s).`);
    }
  };

  const handleBulkStatusChange = (status: string) => {
    const ids = Array.from(selectedIds);
    bulkUpdateStatusMutation.mutate(
      { taskIds: ids, status: status as TaskStatus },
      {
        onSuccess: (results) => {
          reportBulkResult(results, "Statut mis à jour pour toutes les tâches sélectionnées.");
          clearSelection();
        },
      }
    );
  };

  const handleConfirmBulkDelete = () => {
    const ids = Array.from(selectedIds);
    bulkDeleteMutation.mutate(ids, {
      onSuccess: (results) => {
        reportBulkResult(results, "Tâches sélectionnées supprimées.");
        clearSelection();
        setBulkDeleteConfirmOpen(false);
      },
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t("tasksPage.searchTasks")}
              value={searchInput}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* SEC-056 (U1): overdue implies status != DONE server-side (task.repository.ts#buildWhere)
              — disabling the status dropdown while it's active avoids offering a combination that
              would silently conflict, rather than letting the user pick DONE and be confused when
              "overdue" tasks marked DONE never disappear. */}
          <Select value={statusFilter} onValueChange={onStatusFilterChange} disabled={overdueFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("tasksPage.filterByStatus")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">{t("tasksPage.allStatuses")}</SelectItem>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {getStatusLabel(status, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={assigneeFilter ?? UNASSIGNED_FILTER_VALUE}
            onValueChange={(value) => onAssigneeChange(value === UNASSIGNED_FILTER_VALUE ? undefined : value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("tasksPage.filterByAssignee")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED_FILTER_VALUE}>{t("tasksPage.allAssignees")}</SelectItem>
              {assignableUsers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5 px-1">
            <Checkbox id="overdue-filter" checked={overdueFilter} onCheckedChange={(checked) => onOverdueChange(checked === true)} />
            <Label htmlFor="overdue-filter" className="text-sm font-normal cursor-pointer whitespace-nowrap">
              {t("tasksPage.overdueOnly")}
            </Label>
          </div>
        </div>
      </CardHeader>
      {canBulkAct && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 border-t border-b bg-muted/40">
          <span className="text-sm font-medium">{selectedIds.size} tâche(s) sélectionnée(s)</span>
          <Select onValueChange={handleBulkStatusChange} disabled={bulkUpdateStatusMutation.isPending}>
            <SelectTrigger className="w-[200px] h-8 text-xs">
              <SelectValue placeholder="Changer le statut..." />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {getStatusLabel(status, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1 text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={() => setBulkDeleteConfirmOpen(true)}
              disabled={bulkDeleteMutation.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 ml-auto" onClick={clearSelection}>
            <X className="h-3.5 w-3.5" />
            Annuler la sélection
          </Button>
        </div>
      )}
      <CardContent className="p-0">
        {/* SEC-056 (U2): the table below uses a fixed-pixel-column grid with no stacked variant,
            unusable without horizontal scroll on a narrow screen — unlike ProjectsPage's
            grid-cols-1 md:grid-cols-2 cards. Rather than reworking the virtualized table's
            row-height math for a variable-height card, the two views are kept structurally
            separate: the existing virtualized table stays desktop-only (hidden below sm), and a
            plain (non-virtualized) card list takes over on narrow screens. This list is already
            paginated at 10 rows (unlike the 200-row Kanban board), so the perf case for
            virtualizing the mobile view isn't there in practice. */}
        <div className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                {canBulkAct && (
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="Tout sélectionner sur cette page"
                      checked={allOnPageSelected}
                      onCheckedChange={(checked) => toggleSelectAllOnPage(checked === true)}
                    />
                  </TableHead>
                )}
                <SortableTableHead column="title" label={t("common.title")} sortBy={orderBy ?? "createdAt"} sortOrder={orderDir} onSort={onSort} />
                <SortableTableHead column="project" label={t("common.project")} sortBy={orderBy ?? "createdAt"} sortOrder={orderDir} onSort={onSort} />
                <SortableTableHead column="status" label={t("common.status")} sortBy={orderBy ?? "createdAt"} sortOrder={orderDir} onSort={onSort} />
                {isFreelancer ? (
                  <TableHead>{t("common.priority")}</TableHead>
                ) : (
                  <TableHead>Assigné à</TableHead>
                )}
                <SortableTableHead column="dueDate" label={t("common.dueDate")} sortBy={orderBy ?? "createdAt"} sortOrder={orderDir} onSort={onSort} />
                {!isFreelancer && (
                  <SortableTableHead column="priority" label={t("common.priority")} sortBy={orderBy ?? "createdAt"} sortOrder={orderDir} onSort={onSort} />
                )}
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
                const task = tasks[virtualRow.index];
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
                      <div className={(isFreelancer ? "grid grid-cols-[minmax(220px,2fr)_minmax(180px,1.2fr)_140px_120px_160px_90px]" : "grid grid-cols-[40px_minmax(220px,2fr)_minmax(180px,1.2fr)_140px_220px_160px_120px_90px]") + " items-center gap-0 px-4 h-14"}>
                        {canBulkAct && (
                          <div>
                            <Checkbox
                              aria-label={`Sélectionner ${task.title}`}
                              checked={selectedIds.has(task.id)}
                              onCheckedChange={() => toggleSelected(task.id)}
                            />
                          </div>
                        )}
                        <div className="font-medium truncate pr-4">{task.title}</div>
                        <div className="truncate pr-4">{projectName ?? "-"}</div>
                        <div>
                          <Badge className={getTaskStatusBadgeClass(task.status)}>
                            {getStatusLabel(task.status, t)}
                          </Badge>
                        </div>
                        {isFreelancer ? (
                          <div>
                            <Badge className={PRIORITY_BADGE[task.priority] + " text-xs"}>
                              {t("tasks.priorities." + task.priority, task.priority)}
                            </Badge>
                          </div>
                        ) : (
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
                        )}
                        <div className={dueDateColor}>
                          {task.dueDate ? format(new Date(task.dueDate), "dd MMM yyyy") : "-"}
                        </div>
                        {!isFreelancer && (
                          <div>
                            <Badge className={PRIORITY_BADGE[task.priority] + " text-xs"}>
                              {t("tasks.priorities." + task.priority, task.priority)}
                            </Badge>
                          </div>
                        )}
                        <div className="flex justify-end">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Voir" onClick={() => onView(task)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {(!isFreelancer || task.assigneeId === currentUserId) && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" title={t("common.edit")} onClick={() => onEdit(task)}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" title={t("common.delete")} onClick={() => onDelete(task)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="sm:hidden divide-y">
          {tasks.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("tasksPage.noTasksFound")}</p>
          )}
          {tasks.map((task) => {
            const projectName = projectNameById.get(task.projectId);
            const assignee = task.assigneeId ? userById.get(task.assigneeId) : undefined;
            const dueDateColor = task.dueDate && isPast(new Date(task.dueDate)) ? "text-red-600 font-medium" : "text-muted-foreground";

            return (
              <div key={task.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{task.title}</span>
                  <Badge className={getTaskStatusBadgeClass(task.status)}>{getStatusLabel(task.status, t)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate">{projectName ?? "-"}</p>
                <div className="flex items-center justify-between gap-2 text-sm">
                  {assignee ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-6 w-6 text-xs shrink-0">
                        <span>{getInitials(assignee.name)}</span>
                      </Avatar>
                      <span className="truncate">{assignee.name}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                  <Badge className={PRIORITY_BADGE[task.priority] + " text-xs shrink-0"}>
                    {t("tasks.priorities." + task.priority, task.priority)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className={"text-sm " + dueDateColor}>
                    {task.dueDate ? format(new Date(task.dueDate), "dd MMM yyyy") : "-"}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Voir" onClick={() => onView(task)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {(!isFreelancer || task.assigneeId === currentUserId) && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("common.edit")} onClick={() => onEdit(task)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" aria-label={t("common.delete")} onClick={() => onDelete(task)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DataTablePagination page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} />
      </CardContent>

      <ConfirmDeleteDialog
        open={bulkDeleteConfirmOpen}
        onOpenChange={setBulkDeleteConfirmOpen}
        onConfirm={handleConfirmBulkDelete}
        title={`Supprimer ${selectedIds.size} tâche(s) ?`}
        description="Cette action est irréversible. Les tâches sélectionnées seront définitivement supprimées."
        isDeleting={bulkDeleteMutation.isPending}
      />
    </Card>
  );
}
