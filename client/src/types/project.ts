import { Client } from "./client";
import { Task } from "./task";

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: "PLANNING" | "IN_PROGRESS" | "REVIEW" | "COMPLETED";
  clientId?: string;
  companyId: string;
  budget?: string | null;
  deadline?: string | null;
  createdAt: string;
  updatedAt: string;
  client?: Client;
  tasks?: Task[];
  progress: number;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  status?: Project["status"];
  clientId?: string;
}

export interface UpdateProjectInput extends Partial<CreateProjectInput> {
  id: string;
}
