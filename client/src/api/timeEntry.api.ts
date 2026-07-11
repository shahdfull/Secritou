import api from "./axios";

export interface TimeEntry {
  id: string;
  projectId: string;
  userId: string;
  taskId: string | null;
  description: string | null;
  minutes: number;
  date: string;
  createdAt: string;
  user: { id: string; name: string };
  task: { id: string; title: string } | null;
}

export interface TimeEntrySummary {
  totalMinutes: number;
  totalHours: number;
  byUser: Array<{ userId: string; userName: string; totalMinutes: number }>;
  byTask: Array<{ taskId: string; taskTitle: string; totalMinutes: number }>;
}

export interface MyTimeSummary {
  totalMinutes: number;
  totalHours: number;
  hourlyRate: number | null;
  amountDue: number | null;
}

export interface CreateTimeEntryInput {
  taskId?: string;
  description?: string;
  minutes: number;
  date: string;
}

export const timeEntryApi = {
  list: async (projectId: string, page = 1, pageSize = 20) => {
    const res = await api.get<{ data: TimeEntry[]; total: number; page: number; pageSize: number }>(
      `/projects/${projectId}/time-entries`,
      { params: { page, pageSize } }
    );
    return res.data;
  },

  create: async (projectId: string, data: CreateTimeEntryInput): Promise<TimeEntry> => {
    const res = await api.post<{ data: TimeEntry }>(`/projects/${projectId}/time-entries`, data);
    return res.data.data;
  },

  getSummary: async (projectId: string): Promise<TimeEntrySummary> => {
    const res = await api.get<{ data: TimeEntrySummary }>(`/projects/${projectId}/time-summary`);
    return res.data.data;
  },

  getMySummary: async (projectId: string): Promise<MyTimeSummary> => {
    const res = await api.get<{ data: MyTimeSummary }>(`/projects/${projectId}/my-time-summary`);
    return res.data.data;
  },
};
