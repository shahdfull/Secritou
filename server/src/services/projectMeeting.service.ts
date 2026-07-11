import type { MeetingFrequency } from "@prisma/client";
import { projectMeetingRepository } from "../repositories/projectMeeting.repository.js";

export const projectMeetingService = {
  async listByProject(projectId: string) {
    return projectMeetingRepository.listByProject(projectId);
  },

  async create(projectId: string, data: { meetingDate: Date; participants?: string; notes?: string }, createdById?: string) {
    return projectMeetingRepository.create({ projectId, ...data, createdById });
  },

  async getSchedule(projectId: string) {
    return projectMeetingRepository.getSchedule(projectId);
  },

  async setSchedule(projectId: string, frequency: MeetingFrequency, nextMeetingDate: Date | null) {
    return projectMeetingRepository.setSchedule(projectId, frequency, frequency === "NONE" ? null : nextMeetingDate);
  },
};
