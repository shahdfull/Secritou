import type { Task } from "@/types/task";
import { TASK_STATUSES, TASK_PRIORITIES, ALLOWED_TASK_TRANSITIONS } from "@secritou/shared";
import type { TFunction } from "i18next";

// Re-exported so task status pickers can disable invalid transitions the same way
// ProjectsPage does with PROJECT_STATUS_VALID_TRANSITIONS — single source of truth is
// task.schema.ts in @secritou/shared, mirrored server-side by task.service.ts.
export { ALLOWED_TASK_TRANSITIONS };

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export const STATUS_OPTIONS: Task["status"][] = [...TASK_STATUSES];
export const PRIORITY_OPTIONS: Task["priority"][] = [...TASK_PRIORITIES];

export const PRIORITY_BADGE: Record<Task["priority"], string> = {
  LOW: "bg-gray-100 text-gray-600",
  NORMAL: "bg-blue-100 text-blue-600",
  HIGH: "bg-orange-100 text-orange-700",
  URGENT: "bg-red-100 text-red-700 font-semibold",
};

export function getStatusLabel(status: Task["status"], t: TFunction): string {
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
}
