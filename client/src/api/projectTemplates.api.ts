import apiClient from "./axios";

export interface TaskTemplateItem {
  id: string;
  title: string;
  description: string | null;
  orderIndex: number;
}

export interface ProjectTemplate {
  id: string;
  serviceId: string;
  name: string;
  tasks: TaskTemplateItem[];
}

export const projectTemplatesApi = {
  getForService: async (serviceId: string): Promise<ProjectTemplate | null> => {
    const res = await apiClient.get<{ data: ProjectTemplate | null }>(`/services/${serviceId}/template`);
    return res.data.data;
  },

  applyToProject: async (projectId: string) => {
    const res = await apiClient.post<{ data: unknown[] }>(`/projects/${projectId}/apply-template`);
    return res.data.data;
  },
};
