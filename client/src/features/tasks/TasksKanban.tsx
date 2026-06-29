import { memo, useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { useUpdateTask } from "@/hooks/useTasks";
import type { Task } from "@/types/task";
import { TASK_STATUSES } from "@secritou/shared";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { format, isPast } from "date-fns";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Lock } from "lucide-react";

interface StatusConfig {
  label: string;
  bgColor: string;
}

const STATUS_CONFIG: Record<Task["status"], StatusConfig> = {
  TODO: { label: "À faire", bgColor: "bg-gray-100 text-gray-800" },
  IN_PROGRESS: { label: "En cours", bgColor: "bg-blue-100 text-blue-800" },
  REVIEW: { label: "En révision", bgColor: "bg-yellow-100 text-yellow-800" },
  DONE: { label: "Terminé", bgColor: "bg-green-100 text-green-800" },
};

const COLUMN_STATUSES: Task["status"][] = [...TASK_STATUSES];

interface SortableTaskCardProps {
  task: Task;
  onClick?: () => void;
  draggable: boolean;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const PRIORITY_LABEL: Record<Task["priority"], string> = {
  LOW: "Faible",
  NORMAL: "Normale",
  HIGH: "Haute",
  URGENT: "Urgente",
};

const SortableTaskCard = memo(function SortableTaskCard({ task, onClick, draggable }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !draggable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 999 : "auto",
  };

  const dueDateColor = task.dueDate && isPast(new Date(task.dueDate)) ? "text-red-600" : "text-muted-foreground";

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(draggable ? listeners : {})}
      onClick={onClick}
      className={draggable
        ? "cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow"
        : "cursor-default shadow-sm opacity-75 border-dashed"
      }
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="font-medium text-ink flex-1">{task.title}</div>
          <div className="flex items-center gap-1 shrink-0">
            {task.priority && task.priority !== "NORMAL" && (
              <Badge className={
                task.priority === "URGENT" ? "bg-red-100 text-red-700 text-[10px]" :
                task.priority === "HIGH" ? "bg-orange-100 text-orange-700 text-[10px]" :
                "bg-gray-100 text-gray-600 text-[10px]"
              }>
                {PRIORITY_LABEL[task.priority]}
              </Badge>
            )}
            {!draggable && (
              <Lock className="h-3 w-3 text-muted-foreground/50 shrink-0" />
            )}
          </div>
        </div>
        {task.project && (
          <Badge variant="secondary" className="text-xs">
            {task.project.name}
          </Badge>
        )}
        {task.assignee && (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6 text-xs">
              <span>{getInitials(task.assignee.name)}</span>
            </Avatar>
            <span className="text-sm text-muted-foreground">{task.assignee.name}</span>
          </div>
        )}
        {task.dueDate && (
          <div className={`text-sm ${dueDateColor}`}>
            {format(new Date(task.dueDate), "dd MMM")}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

interface KanbanColumnProps {
  status: Task["status"];
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  isDragging: boolean;
  currentUserId?: string;
}

const KanbanColumn = memo(function KanbanColumn({ status, tasks, onTaskClick, isDragging, currentUserId }: KanbanColumnProps) {
  const config = STATUS_CONFIG[status];
  const ids = useMemo(() => tasks.map((task) => task.id), [tasks]);
  const columnBg = status === "DONE" ? "bg-green-50/50" : "bg-card";
  const parentRef = useRef<HTMLDivElement | null>(null);
  const shouldVirtualize = !isDragging && tasks.length > 40;
  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 92,
    overscan: 10,
  });

  return (
    <div className="flex-1 min-w-[280px] max-w-[320px]">
      <div className={`p-3 rounded-t-lg border border-b-0 flex items-center justify-between ${columnBg}`}>
        <h3 className="font-semibold text-ink">{config.label}</h3>
        <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>
      <div
        ref={parentRef}
        className={`p-2 min-h-[400px] max-h-[70vh] overflow-auto rounded-b-lg border border-t-0 ${columnBg}`}
        style={{ contentVisibility: "auto" } as CSSProperties}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {shouldVirtualize ? (
            <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const task = tasks[virtualRow.index];
                if (!task) return null;
                const draggable = !currentUserId || task.assigneeId === currentUserId;
                return (
                  <div
                    key={task.id}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="pb-2"
                  >
                    <SortableTaskCard
                      task={task}
                      onClick={onTaskClick ? () => onTaskClick(task) : undefined}
                      draggable={draggable}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => {
                const draggable = !currentUserId || task.assigneeId === currentUserId;
                return (
                  <SortableTaskCard
                    key={task.id}
                    task={task}
                    onClick={onTaskClick ? () => onTaskClick(task) : undefined}
                    draggable={draggable}
                  />
                );
              })}
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
});

interface TasksKanbanProps {
  filteredTasks: Task[];
  onTaskClick?: (task: Task) => void;
  /** When provided, only tasks assigned to this user ID can be dragged */
  restrictDragToUserId?: string;
}

export const TasksKanban = memo(function TasksKanban({ filteredTasks, onTaskClick, restrictDragToUserId }: TasksKanbanProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { mutate: updateTask } = useUpdateTask();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { groupedTasks, taskIdToStatus, taskIdToAssignee } = useMemo(() => {
    const groups: Record<Task["status"], Task[]> = { TODO: [], IN_PROGRESS: [], REVIEW: [], DONE: [] };
    const statusMap = new Map<string, Task["status"]>();
    const assigneeMap = new Map<string, string | undefined>();
    for (const task of filteredTasks) {
      groups[task.status].push(task);
      statusMap.set(task.id, task.status);
      assigneeMap.set(task.id, task.assigneeId);
    }
    return { groupedTasks: groups, taskIdToStatus: statusMap, taskIdToAssignee: assigneeMap };
  }, [filteredTasks]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as string;
    // Guard: don't allow drag if restricted to a user and this task isn't theirs
    if (restrictDragToUserId && taskIdToAssignee.get(id) !== restrictDragToUserId) return;
    setActiveId(id);
  }, [restrictDragToUserId, taskIdToAssignee]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeId = active.id as string;
    // Guard: silently reject if drag was initiated on a non-owned task
    if (restrictDragToUserId && taskIdToAssignee.get(activeId) !== restrictDragToUserId) return;

    const activeStatus = taskIdToStatus.get(activeId) ?? null;
    const overId = over.id as string;
    let overStatus = taskIdToStatus.get(overId) ?? null;

    if (!activeStatus) return;

    if (!overStatus && COLUMN_STATUSES.includes(overId as Task["status"])) {
      overStatus = overId as Task["status"];
    }

    if (!overStatus || activeStatus === overStatus) return;

    // Optimistic update
    const snapshots = queryClient.getQueriesData({ queryKey: ["tasks"], exact: false });
    queryClient.setQueriesData({ queryKey: ["tasks"], exact: false }, (old: unknown) => {
      if (!old) return old;
      if (Array.isArray(old)) {
        return old.map((task) => (task?.id === activeId ? { ...task, status: overStatus } : task));
      }
      if (typeof old === "object" && old !== null && "data" in old) {
        const o = old as { data?: unknown };
        if (Array.isArray(o.data)) {
          return {
            ...(old as object),
            data: o.data.map((task) => {
              if (typeof task === "object" && task !== null && "id" in task && (task as { id?: unknown }).id === activeId) {
                return { ...(task as object), status: overStatus };
              }
              return task;
            }),
          };
        }
      }
      return old;
    });

    updateTask(
      { id: activeId, data: { status: overStatus } },
      {
        onError: () => {
          for (const [key, data] of snapshots) {
            queryClient.setQueryData(key, data);
          }
          toast.error(t("toasts.taskStatusUpdateError"));
        },
      }
    );
  }, [queryClient, taskIdToStatus, taskIdToAssignee, restrictDragToUserId, updateTask, t]);

  const activeTask = useMemo(
    () => (activeId ? filteredTasks.find((task) => task.id === activeId) ?? null : null),
    [activeId, filteredTasks]
  );

  return (
    <div className="overflow-x-auto pb-4">
      {restrictDragToUserId && (
        <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
          <Lock className="h-3 w-3" />
          {t("tasksPage.kanbanDragHint")}
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 min-w-max">
          {COLUMN_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={groupedTasks[status]}
              onTaskClick={onTaskClick}
              isDragging={!!activeId}
              currentUserId={restrictDragToUserId}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? (
            <Card className="shadow-xl opacity-80">
              <CardContent className="p-4 space-y-2">
                <div className="font-medium text-ink">{activeTask.title}</div>
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
});
