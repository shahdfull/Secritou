import type { MeetingFrequency } from "@prisma/client";
import { projectMeetingRepository } from "../repositories/projectMeeting.repository.js";
import { assertProjectInScope, type ServiceScope } from "../utils/serviceScope.js";

export const projectMeetingService = {
  async listByProject(projectId: string, scope?: ServiceScope) {
    await assertProjectInScope(projectId, scope);
    return projectMeetingRepository.listByProject(projectId);
  },

  async create(projectId: string, data: { meetingDate: Date; participants?: string; notes?: string }, createdById?: string, scope?: ServiceScope) {
    await assertProjectInScope(projectId, scope);
    return projectMeetingRepository.create({ projectId, ...data, createdById });
  },

  async getSchedule(projectId: string, scope?: ServiceScope) {
    await assertProjectInScope(projectId, scope);
    return projectMeetingRepository.getSchedule(projectId);
  },

  async setSchedule(projectId: string, frequency: MeetingFrequency, nextMeetingDate: Date | null, scope?: ServiceScope) {
    await assertProjectInScope(projectId, scope);
    return projectMeetingRepository.setSchedule(projectId, frequency, frequency === "NONE" ? null : nextMeetingDate);
  },
};
