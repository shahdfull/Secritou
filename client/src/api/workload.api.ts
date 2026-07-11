import api from "./axios";

export interface WorkloadItem {
  userId: string;
  userName: string;
  totalMinutes: number;
  totalHours: number;
  activeTaskCount: number;
}

export const workloadApi = {
  getWorkload: async (params?: { from?: string; to?: string }): Promise<WorkloadItem[]> => {
    const res = await api.get<{ data: WorkloadItem[] }>("/analytics/workload", { params });
    return res.data.data;
  },
};
