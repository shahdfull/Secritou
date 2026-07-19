import apiClient from "./axios";

export interface ProjectMeeting {
  id: string;
  projectId: string;
  meetingDate: string;
  participants: string | null;
  notes: string | null;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
}

export type MeetingFrequency = "NONE" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

export interface MeetingSchedule {
  id: string;
  meetingFrequency: MeetingFrequency;
  nextMeetingDate: string | null;
}

export interface ProjectMeetingsPage {
  data: ProjectMeeting[];
  total: number;
}

export const projectMeetingsApi = {
  // SEC-055 (F6): page/pageSize are optional — omitting both keeps the pre-existing unpaginated
  // behavior (server returns every meeting, total equal to data.length).
  list: async (projectId: string, page?: number, pageSize?: number): Promise<ProjectMeetingsPage> => {
    const res = await apiClient.get<ProjectMeetingsPage>(`/projects/${projectId}/meetings`, {
      params: page && pageSize ? { page, pageSize } : undefined,
    });
    return res.data;
  },

  create: async (projectId: string, data: { meetingDate: string; participants?: string; notes?: string }): Promise<ProjectMeeting> => {
    const res = await apiClient.post<{ data: ProjectMeeting }>(`/projects/${projectId}/meetings`, data);
    return res.data.data;
  },

  update: async (
    projectId: string,
    meetingId: string,
    data: { meetingDate?: string; participants?: string; notes?: string }
  ): Promise<ProjectMeeting> => {
    const res = await apiClient.put<{ data: ProjectMeeting }>(`/projects/${projectId}/meetings/${meetingId}`, data);
    return res.data.data;
  },

  delete: async (projectId: string, meetingId: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/meetings/${meetingId}`);
  },

  getSchedule: async (projectId: string): Promise<MeetingSchedule> => {
    const res = await apiClient.get<{ data: MeetingSchedule }>(`/projects/${projectId}/meeting-schedule`);
    return res.data.data;
  },

  setSchedule: async (projectId: string, data: { frequency: MeetingFrequency; nextMeetingDate?: string }): Promise<MeetingSchedule> => {
    const res = await apiClient.put<{ data: MeetingSchedule }>(`/projects/${projectId}/meeting-schedule`, data);
    return res.data.data;
  },
};
