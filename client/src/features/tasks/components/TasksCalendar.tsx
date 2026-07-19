// SEC-060 (vue calendrier/Gantt, item 3 du constat P1 rapport Product Owner) : aucune vue
// calendrier n'existait sur le module Tâches — décision du porteur : un calendrier mensuel simple
// (grille jour/tâches-à-échéance), pas un vrai Gantt avec barres de durée. Réutilise le composant
// `Calendar` (react-day-picker) déjà en place dans le dépôt, sur le même modèle que
// TasksKanban.tsx : reçoit une liste de tâches déjà chargée (pageSize 200, comme le Kanban), pas
// paginée — un calendrier a besoin de voir toutes les tâches du mois affiché à la fois.
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { format, isSameDay, isSameMonth, isPast } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTaskStatusBadgeClass } from "@/utils/statusColors";
import type { Task } from "@/types/task";
import { getStatusLabel } from "../taskUtils";

interface TasksCalendarProps {
  tasks: Task[];
  projectNameById: Map<string, string>;
  onView: (task: Task) => void;
}

export function TasksCalendar({ tasks, projectNameById, onView }: TasksCalendarProps) {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [month, setMonth] = useState<Date>(new Date());

  const tasksWithDueDate = useMemo(() => tasks.filter((task) => !!task.dueDate), [tasks]);

  const daysWithTasks = useMemo(
    () => tasksWithDueDate.map((task) => new Date(task.dueDate!)),
    [tasksWithDueDate]
  );

  const tasksOnSelectedDay = useMemo(
    () => tasksWithDueDate.filter((task) => isSameDay(new Date(task.dueDate!), selectedDate)),
    [tasksWithDueDate, selectedDate]
  );

  return (
    <Card>
      <CardContent className="flex flex-col md:flex-row gap-6 p-4 md:p-6">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => date && setSelectedDate(date)}
          month={month}
          onMonthChange={setMonth}
          locale={fr}
          modifiers={{ hasTasks: daysWithTasks }}
          modifiersClassNames={{ hasTasks: "font-bold underline decoration-2 decoration-primary underline-offset-4" }}
          className="rounded-md border"
        />

        <div className="flex-1 space-y-3 min-w-0">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {format(selectedDate, "d MMMM yyyy", { locale: fr })}
            {!isSameMonth(selectedDate, month) && " (hors du mois affiché)"}
          </h3>

          {tasksOnSelectedDay.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("tasksPage.noTasksFound")}
            </p>
          ) : (
            <ul className="space-y-2">
              {tasksOnSelectedDay.map((task) => {
                const overdue = task.status !== "DONE" && isPast(new Date(task.dueDate!)) && !isSameDay(new Date(task.dueDate!), new Date());
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => onView(task)}
                      className="w-full text-left rounded-lg border border-border p-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={"font-medium text-sm " + (overdue ? "text-red-600" : "")}>{task.title}</span>
                        <Badge className={getTaskStatusBadgeClass(task.status)}>{getStatusLabel(task.status, t)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {projectNameById.get(task.projectId) ?? "-"}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
