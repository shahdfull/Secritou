import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { format, isPast } from "date-fns";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
  type SortChangedEvent,
  type SelectionChangedEvent,
  type GridReadyEvent,
  type GridApi,
} from "ag-grid-community";
import { getTaskStatusBadgeClass } from "@/utils/statusColors";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DataTablePagination } from "@/components/common/DataTablePagination";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ConfirmDeleteDialog } from "@/components/shared/crud/ConfirmDeleteDialog";
import { Search, Edit, Trash2, Eye, X, AlertTriangle, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import type { Task, TaskStatus } from "@/types/task";
import type { User } from "@/types/auth";
import { useBulkUpdateTaskStatus, useBulkDeleteTasks } from "@/hooks/useTasks";
import { getInitials, getStatusLabel, STATUS_OPTIONS, PRIORITY_OPTIONS, PRIORITY_BADGE } from "../taskUtils";

ModuleRegistry.registerModules([AllCommunityModule]);

// SEC-056 follow-up (migration AG Grid) : thème clair unique, cohérent avec le reste de
// l'application qui n'a pas de mode sombre. Couleurs alignées sur les tokens Tailwind déjà
// utilisés ailleurs (primary teal, bordures neutres) plutôt que le violet par défaut de Quartz.
const tasksGridTheme = themeQuartz.withParams({
  accentColor: "#0f766e",
  headerBackgroundColor: "#f8fafc",
  headerTextColor: "#334155",
  rowHoverColor: "#f1f5f9",
  borderColor: "#e2e8f0",
  fontFamily: "inherit",
});

// AG Grid ne connaît pas les colonnes serveur "project"/"dueDate" telles qu'exposées par
// SortableTableHead (mêmes noms que côté API) — ce mapping garde task.repository.ts#buildOrderBy
// comme seule source de vérité pour les noms de colonnes triables, sans dupliquer leur liste ici.
const AG_FIELD_TO_SORT_COLUMN: Record<string, string> = {
  title: "title",
  projectName: "project",
  status: "status",
  dueDate: "dueDate",
  priority: "priority",
};

// Champs plats attendus par AG Grid — projet/assigné déjà résolus depuis projectNameById/userById
// une seule fois par rendu (voir gridRows), plutôt que par un lookup dans chaque cellRenderer.
export interface TaskGridRow extends Task {
  projectName: string;
  assignee: User | undefined;
}

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
  projectId: string | undefined;
  onProjectChange: (value: string | undefined) => void;
  projectOptions: { id: string; name: string }[];
  priority: string | undefined;
  onPriorityChange: (value: string | undefined) => void;
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
  // Test-only hook: AG Grid virtualizes rows and renders none in JSDOM (no real viewport), so
  // tests drive selection via gridApi.selectAll() instead of clicking a row checkbox — this is
  // the seam that exposes the api for that. Never passed by TasksPage.tsx in production.
  onGridApiReady?: (api: GridApi<TaskGridRow>) => void;
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
  onGridApiReady,
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
    projectId: projectFilter,
    onProjectChange,
    projectOptions,
    priority: priorityFilter,
    onPriorityChange,
  } = filters;
  const { orderBy, orderDir, onSort } = sort;
  const { page, pageSize, total, onPageChange } = pagination;
  const { isFreelancer, currentUserId, canDelete } = permissions;
  const { onView, onEdit, onDelete } = actions;
  const gridApiRef = useRef<GridApi<TaskGridRow> | null>(null);

  // SEC-060 (actions en masse) : réservées à ADMIN/MANAGER — mêmes routes serveur
  // (authorize("ADMIN","MANAGER") sur /tasks/bulk/*) qu'un FREELANCER ne peut de toute façon pas
  // atteindre ; la case à cocher de sélection n'est donc affichée que si `!isFreelancer`.
  const canBulkAct = !isFreelancer;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const bulkUpdateStatusMutation = useBulkUpdateTaskStatus();
  const bulkDeleteMutation = useBulkDeleteTasks();

  // AG Grid affiche des champs plats — projet/assigné déjà résolus ici une seule fois par
  // rendu plutôt que dans chaque cellRenderer (mêmes lookups que l'ancienne vue table/carte).
  const gridRows = useMemo<TaskGridRow[]>(
    () =>
      tasks.map((task) => ({
        ...task,
        projectName: projectNameById.get(task.projectId) ?? "-",
        assignee: task.assigneeId ? userById.get(task.assigneeId) : undefined,
      })),
    [tasks, projectNameById, userById]
  );

  // AG Grid possède déjà sa propre notion de "sélection" (rowSelection) — cet effet la synchronise
  // vers selectedIds (utilisé par la barre d'actions groupées et les mutations bulk existantes)
  // plutôt que de dupliquer l'état de sélection en deux endroits.
  const handleSelectionChanged = useCallback((event: SelectionChangedEvent<TaskGridRow>) => {
    const selected = event.api.getSelectedRows();
    setSelectedIds(new Set(selected.map((row) => row.id)));
  }, []);

  const clearSelection = () => {
    setSelectedIds(new Set());
    gridApiRef.current?.deselectAll();
  };

  const activeAdvancedFiltersCount =
    (assigneeFilter ? 1 : 0) + (projectFilter ? 1 : 0) + (priorityFilter ? 1 : 0) + (overdueFilter ? 1 : 0);

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

  const onGridReady = useCallback(
    (event: GridReadyEvent<TaskGridRow>) => {
      gridApiRef.current = event.api;
      onGridApiReady?.(event.api);
    },
    [onGridApiReady]
  );

  // Le tri reste piloté par le serveur (task.repository.ts#buildOrderBy) — AG Grid ne fait ici
  // qu'émettre l'intention de tri ; il ne trie jamais les lignes lui-même (multiSortKey off,
  // une seule colonne active à la fois, cohérent avec l'ancien SortableTableHead).
  const handleSortChanged = useCallback(
    (event: SortChangedEvent<TaskGridRow>) => {
      const sortedCol = event.api.getColumnState().find((c) => c.sort);
      if (!sortedCol) return;
      const column = AG_FIELD_TO_SORT_COLUMN[sortedCol.colId];
      if (column) onSort(column);
    },
    [onSort]
  );

  const dueDateRenderer = useCallback(
    (params: ICellRendererParams<TaskGridRow>) => {
      const task = params.data;
      if (!task) return null;
      const overdue = !!task.dueDate && isPast(new Date(task.dueDate));
      return (
        <div className={"flex h-full items-center gap-1" + (overdue ? " text-red-600 font-medium" : "")}>
          {overdue && <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-label={t("tasksPage.overdue", "En retard")} />}
          {task.dueDate ? format(new Date(task.dueDate), "dd MMM yyyy") : "-"}
        </div>
      );
    },
    [t]
  );

  const priorityRenderer = useCallback(
    (params: ICellRendererParams<TaskGridRow>) => {
      const task = params.data;
      if (!task) return null;
      return (
        <div className="flex h-full items-center">
          <Badge className={PRIORITY_BADGE[task.priority] + " text-xs"}>
            {t("tasks.priorities." + task.priority, task.priority)}
          </Badge>
        </div>
      );
    },
    [t]
  );

  const statusRenderer = useCallback(
    (params: ICellRendererParams<TaskGridRow>) => {
      const task = params.data;
      if (!task) return null;
      return (
        <div className="flex h-full items-center">
          <Badge className={getTaskStatusBadgeClass(task.status)}>{getStatusLabel(task.status, t)}</Badge>
        </div>
      );
    },
    [t]
  );

  const assigneeRenderer = useCallback((params: ICellRendererParams<TaskGridRow>) => {
    const assignee = params.data?.assignee;
    if (!assignee) return <span className="text-muted-foreground">-</span>;
    return (
      <div className="flex h-full items-center gap-2 min-w-0">
        <Avatar className="h-6 w-6 text-xs shrink-0">
          <span>{getInitials(assignee.name)}</span>
        </Avatar>
        <span className="text-sm truncate">{assignee.name}</span>
      </div>
    );
  }, []);

  const actionsRenderer = useCallback(
    (params: ICellRendererParams<TaskGridRow>) => {
      const task = params.data;
      if (!task) return null;
      return (
        <div className="flex h-full items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Voir" aria-label="Voir" onClick={() => onView(task)}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {(!isFreelancer || task.assigneeId === currentUserId) && (
            <Button variant="ghost" size="icon" className="h-7 w-7" title={t("common.edit")} aria-label={t("common.edit")} onClick={() => onEdit(task)}>
              <Edit className="h-3.5 w-3.5" />
            </Button>
          )}
          {canDelete && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" title={t("common.delete")} aria-label={t("common.delete")} onClick={() => onDelete(task)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      );
    },
    [isFreelancer, currentUserId, canDelete, onView, onEdit, onDelete, t]
  );

  // Reflète orderBy/orderDir (état de tri piloté par le serveur) sur la colonne AG Grid
  // correspondante, pour que la flèche de tri affichée reste synchronisée avec les données
  // réellement triées — sans quoi le premier chargement afficherait une grille non triée
  // visuellement alors que les lignes le sont bel et bien (tri par défaut createdAt côté serveur).
  const sortForField = useCallback(
    (field: string): "asc" | "desc" | null => {
      const activeColumn = orderBy ?? "createdAt";
      return AG_FIELD_TO_SORT_COLUMN[field] === activeColumn ? orderDir : null;
    },
    [orderBy, orderDir]
  );

  const columnDefs = useMemo<ColDef<TaskGridRow>[]>(() => {
    const cols: ColDef<TaskGridRow>[] = [
      {
        field: "title",
        headerName: t("common.title"),
        flex: 3,
        minWidth: 220,
        sortable: true,
        sort: sortForField("title"),
        comparator: () => 0, // tri serveur — AG Grid n'a que la valeur de la page courante
        tooltipField: "title",
        cellClass: "font-medium",
      },
      {
        field: "projectName",
        headerName: t("common.project"),
        flex: 2,
        minWidth: 180,
        sortable: true,
        sort: sortForField("projectName"),
        comparator: () => 0,
        tooltipField: "projectName",
      },
      {
        field: "status",
        headerName: t("common.status"),
        width: 140,
        sortable: true,
        sort: sortForField("status"),
        comparator: () => 0,
        cellRenderer: statusRenderer,
      },
    ];

    if (isFreelancer) {
      cols.push({
        field: "priority",
        colId: "priority",
        headerName: t("common.priority"),
        width: 120,
        cellRenderer: priorityRenderer,
      });
    } else {
      cols.push({
        field: "assignee",
        headerName: "Assigné à",
        width: 180,
        cellRenderer: assigneeRenderer,
      });
    }

    cols.push({
      field: "dueDate",
      headerName: t("common.dueDate"),
      width: 150,
      sortable: true,
      sort: sortForField("dueDate"),
      comparator: () => 0,
      cellRenderer: dueDateRenderer,
    });

    if (!isFreelancer) {
      cols.push({
        field: "priority",
        headerName: t("common.priority"),
        width: 120,
        sortable: true,
        sort: sortForField("priority"),
        comparator: () => 0,
        cellRenderer: priorityRenderer,
        colId: "priority",
      });
    }

    cols.push({
      headerName: t("common.actions"),
      width: 110,
      sortable: false,
      resizable: false,
      cellRenderer: actionsRenderer,
      pinned: "right",
    });

    return cols;
  }, [t, isFreelancer, sortForField, statusRenderer, priorityRenderer, assigneeRenderer, dueDateRenderer, actionsRenderer]);

  const defaultColDef = useMemo<ColDef<TaskGridRow>>(
    () => ({
      resizable: true,
      suppressMovable: false,
    }),
    []
  );

  return (
    <Card>
      <CardHeader className="flex flex-col md:flex-row md:items-center gap-3">
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
        <div className="flex items-center gap-2 shrink-0">
          {/* SEC-056 (U1): overdue implies status != DONE server-side (task.repository.ts#buildWhere)
              — disabling the status dropdown while it's active avoids offering a combination that
              would silently conflict, rather than letting the user pick DONE and be confused when
              "overdue" tasks marked DONE never disappear. */}
          <Select value={statusFilter} onValueChange={onStatusFilterChange} disabled={overdueFilter}>
            <SelectTrigger className="w-[170px]">
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

          {/* SEC-056 follow-up (barre de filtres surchargee, retour designer) : Assigne/Projet/
              Priorite/En retard deplaces dans un panneau repliable — seuls Recherche et Statut
              restent visibles en permanence. Le compteur sur le bouton donne une visibilite
              immediate sur le nombre de filtres actifs sans avoir a ouvrir le panneau. */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2 shrink-0">
                <SlidersHorizontal className="h-4 w-4" />
                {t("tasksPage.advancedFilters")}
                {activeAdvancedFiltersCount > 0 && (
                  <Badge className="h-5 min-w-5 justify-center rounded-full bg-primary px-1 text-xs text-primary-foreground">
                    {activeAdvancedFiltersCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("tasksPage.filterByAssignee")}</Label>
                <Select
                  value={assigneeFilter ?? UNASSIGNED_FILTER_VALUE}
                  onValueChange={(value) => onAssigneeChange(value === UNASSIGNED_FILTER_VALUE ? undefined : value)}
                >
                  <SelectTrigger className="w-full">
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
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("tasksPage.filterByProject")}</Label>
                <Select
                  value={projectFilter ?? UNASSIGNED_FILTER_VALUE}
                  onValueChange={(value) => onProjectChange(value === UNASSIGNED_FILTER_VALUE ? undefined : value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("tasksPage.filterByProject")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED_FILTER_VALUE}>{t("tasksPage.allProjects")}</SelectItem>
                    {projectOptions.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!isFreelancer && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t("tasksPage.filterByPriority")}</Label>
                  <Select
                    value={priorityFilter ?? UNASSIGNED_FILTER_VALUE}
                    onValueChange={(value) => onPriorityChange(value === UNASSIGNED_FILTER_VALUE ? undefined : value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("tasksPage.filterByPriority")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED_FILTER_VALUE}>{t("tasksPage.allPriorities")}</SelectItem>
                      {PRIORITY_OPTIONS.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {t("tasks.priorities." + priority, priority)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center gap-1.5 pt-1">
                <Checkbox id="overdue-filter" checked={overdueFilter} onCheckedChange={(checked) => onOverdueChange(checked === true)} />
                <Label htmlFor="overdue-filter" className="text-sm font-normal cursor-pointer">
                  {t("tasksPage.overdueOnly")}
                </Label>
              </div>
            </PopoverContent>
          </Popover>
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
        {/* SEC-056 follow-up (migration AG Grid) : la table manuelle + virtualisation
            @tanstack/react-virtual est remplacée par AG Grid, qui gère nativement la
            virtualisation des lignes et la sélection multiple (rowSelection) — même
            comportement, moins de code custom à maintenir. La vue carte mobile (sm:hidden
            ci-dessous) reste inchangée : AG Grid n'a pas vocation à remplacer une mise en page
            en cartes empilées sur petit écran. */}
        <div className="hidden sm:block" style={{ height: "65vh" }}>
          <AgGridReact<TaskGridRow>
            theme={tasksGridTheme}
            rowData={gridRows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            rowHeight={56}
            headerHeight={44}
            rowSelection={canBulkAct ? { mode: "multiRow", headerCheckbox: true, checkboxes: true } : undefined}
            onSelectionChanged={canBulkAct ? handleSelectionChanged : undefined}
            onSortChanged={handleSortChanged}
            onGridReady={onGridReady}
            tooltipShowDelay={300}
            suppressCellFocus
            overlayNoRowsTemplate={t("tasksPage.noTasksFound")}
          />
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
                  <span className="font-medium" title={task.title}>{task.title}</span>
                  <Badge className={getTaskStatusBadgeClass(task.status)}>{getStatusLabel(task.status, t)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate" title={projectName ?? undefined}>{projectName ?? "-"}</p>
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
                  <span className={"text-sm flex items-center gap-1 " + dueDateColor}>
                    {task.dueDate && isPast(new Date(task.dueDate)) && (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-label={t("tasksPage.overdue", "En retard")} />
                    )}
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
