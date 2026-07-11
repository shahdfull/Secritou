import { Project } from "./project";
import { User } from "./auth";
import type { TaskStatus, TaskPriority } from "@secritou/shared";

// Re-exported so existing `@/types/task` consumers keep a single import site.
export type { TaskStatus, TaskPriority };

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  startDate?: string;
  dueDate?: string;
  projectId: string;
  assigneeId?: string;
  createdAt: string;
  updatedAt: string;
  project?: Project;
  assignee?: User;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: Task["status"];
  priority?: Task["priority"];
  startDate?: string;
  dueDate?: string;
  projectId: string;
  assigneeId?: string;
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  id: string;
}

export interface FreelancerConflict {
  taskId: string;
  title: string;
  startDate: string;
  dueDate: string;
  projectId: string;
  projectName: string | null;
}
