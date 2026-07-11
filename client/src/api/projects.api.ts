import apiClient from "./axios";
import type { Project, CreateProjectInput, UpdateProjectInput } from "../types/project";
import type { ApiResponse } from "../types/auth";
import type { ListQueryParams, PaginatedResponse } from "../types/pagination";

export type BriefQuestionType = "boolean" | "textarea" | "multiselect" | "number" | "text";

export interface BriefQuestion {
  key: string;
  label: string;
  type: BriefQuestionType;
  options?: string[];
  required?: boolean;
}

export interface BriefProject {
  id: string;
  name: string;
  serviceType: string | null;
  briefData: Record<string, unknown> | null;
  briefCompleted: boolean;
  briefCompletedAt: string | null;
  clientId: string | null;
}

export const projectsApi = {
  getAll: async (params: ListQueryParams = {}): Promise<PaginatedResponse<Project>> => {
    const response = await apiClient.get<PaginatedResponse<Project>>("/projects", { params });
    return response.data;
  },

  getById: async (id: string): Promise<Project> => {
    const response = await apiClient.get<ApiResponse<Project>>(`/projects/${id}`);
    return response.data.data;
  },

  create: async (data: CreateProjectInput): Promise<Project> => {
    const response = await apiClient.post<ApiResponse<Project>>("/projects", data);
    return response.data.data;
  },

  update: async (id: string, data: Omit<UpdateProjectInput, "id">): Promise<Project> => {
    const response = await apiClient.put<ApiResponse<Project>>(`/projects/${id}`, data);
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/projects/${id}`);
  },

  restore: async (id: string): Promise<Project> => {
    const response = await apiClient.post<ApiResponse<Project>>(`/projects/${id}/restore`);
    return response.data.data;
  },

  getTrash: async (params: ListQueryParams = {}): Promise<PaginatedResponse<Project>> => {
    const response = await apiClient.get<PaginatedResponse<Project>>("/projects/trash", { params });
    return response.data;
  },

  getTimelineStatus: async (id: string): Promise<TimelineStep[]> => {
    const response = await apiClient.get<{ data: TimelineStep[] }>(`/projects/${id}/timeline-status`);
    return response.data.data;
  },

  getBrief: async (id: string): Promise<{ project: BriefProject; questions: BriefQuestion[] }> => {
    const response = await apiClient.get<{ data: { project: BriefProject; questions: BriefQuestion[] } }>(`/projects/${id}/brief`);
    return response.data.data;
  },

  submitBrief: async (id: string, briefData: Record<string, unknown>): Promise<BriefProject> => {
    const response = await apiClient.post<{ data: BriefProject }>(`/projects/${id}/brief/submit`, briefData);
    return response.data.data;
  },

  clientApprove: async (id: string): Promise<{ project: { id: string; name: string }; balanceInvoiceId: string | null }> => {
    const response = await apiClient.post<{ data: { project: { id: string; name: string }; balanceInvoiceId: string | null } }>(`/projects/${id}/client-approve`);
    return response.data.data;
  },
};

export type TimelineStepStatus = "done" | "pending" | "locked";

export interface TimelineStep {
  key: string;
  label: string;
  status: TimelineStepStatus;
  date: string | null;
}
