import apiClient from "./axios";
import type { Task, CreateTaskInput, UpdateTaskInput, FreelancerConflict, TaskStatus } from "../types/task";
import type { ApiResponse } from "../types/auth";
import type { ListQueryParams, PaginatedResponse } from "../types/pagination";

export interface BulkActionResult {
  id: string;
  success: boolean;
  error?: string;
}

export interface TaskListFilters {
  assigneeId?: string;
  overdue?: boolean;
}

export const tasksApi = {
  getAll: async (
    params: ListQueryParams = {},
    projectId?: string,
    taskFilters?: TaskListFilters
  ): Promise<PaginatedResponse<Task>> => {
    const response = await apiClient.get<PaginatedResponse<Task>>("/tasks", {
      params: {
        ...params,
        ...(projectId && { projectId }),
        ...(taskFilters?.assigneeId && { assigneeId: taskFilters.assigneeId }),
        ...(taskFilters?.overdue && { overdue: "true" }),
      },
    });
    return response.data;
  },

  getById: async (id: string): Promise<Task> => {
    const response = await apiClient.get<ApiResponse<Task>>(`/tasks/${id}`);
    return response.data.data;
  },

  create: async (data: CreateTaskInput): Promise<Task> => {
    const response = await apiClient.post<ApiResponse<Task>>("/tasks", data);
    return response.data.data;
  },

  update: async (id: string, data: Omit<UpdateTaskInput, "id">): Promise<Task> => {
    const response = await apiClient.put<ApiResponse<Task>>(`/tasks/${id}`, data);
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/tasks/${id}`);
  },

  getFreelancerAvailability: async (params: {
    freelancerId: string;
    startDate: string;
    endDate: string;
    excludeTaskId?: string;
  }): Promise<FreelancerConflict[]> => {
    const response = await apiClient.get<ApiResponse<{ conflicts: FreelancerConflict[] }>>(
      "/tasks/availability",
      { params }
    );
    return response.data.data.conflicts;
  },

  bulkUpdateStatus: async (taskIds: string[], status: TaskStatus): Promise<BulkActionResult[]> => {
    const response = await apiClient.post<ApiResponse<BulkActionResult[]>>("/tasks/bulk/status", { taskIds, status });
    return response.data.data;
  },

  bulkDelete: async (taskIds: string[]): Promise<BulkActionResult[]> => {
    const response = await apiClient.post<ApiResponse<BulkActionResult[]>>("/tasks/bulk/delete", { taskIds });
    return response.data.data;
  },
};
