import { Project } from "./project";
import { User } from "./auth";

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
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
  dueDate?: string;
  projectId: string;
  assigneeId?: string;
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  id: string;
}
