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

export const projectMeetingsApi = {
  list: async (projectId: string): Promise<ProjectMeeting[]> => {
    const res = await apiClient.get<{ data: ProjectMeeting[] }>(`/projects/${projectId}/meetings`);
    return res.data.data;
  },

  create: async (projectId: string, data: { meetingDate: string; participants?: string; notes?: string }): Promise<ProjectMeeting> => {
    const res = await apiClient.post<{ data: ProjectMeeting }>(`/projects/${projectId}/meetings`, data);
    return res.data.data;
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
