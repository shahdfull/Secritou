import { Client } from "./client";
import { Task } from "./task";
import type { ProjectStatus } from "@secritou/shared";

// Re-exported so existing `@/types/project` consumers keep a single import site.
export type { ProjectStatus };

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  clientId?: string;
  serviceId?: string | null;
  proposalId?: string | null;
  serviceType?: string | null;
  briefData?: Record<string, unknown> | null;
  briefCompleted?: boolean;
  briefCompletedAt?: string | null;
  clientApprovedAt?: string | null;
  budget?: string | null;
  deadline?: string | null;
  createdAt: string;
  updatedAt: string;
  client?: Client;
  tasks?: Task[];
  progress: number;
  taskDone: number;
  taskTotal: number;
  hasDepositInvoice?: boolean;
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
