import type { MeetingFrequency } from "@prisma/client";
import { projectMeetingRepository } from "../repositories/projectMeeting.repository.js";
import { assertProjectInScope, type ServiceScope } from "../utils/serviceScope.js";
import { HttpError } from "../utils/httpError.js";

export const projectMeetingService = {
  async listByProject(projectId: string, scope?: ServiceScope, page?: number, pageSize?: number) {
    await assertProjectInScope(projectId, scope);
    return projectMeetingRepository.listByProject(projectId, page, pageSize);
  },

  async create(projectId: string, data: { meetingDate: Date; participants?: string; notes?: string }, createdById?: string, scope?: ServiceScope) {
    await assertProjectInScope(projectId, scope);
    return projectMeetingRepository.create({ projectId, ...data, createdById });
  },

  // SEC-055 (F6): update/delete were entirely absent server-side (only GET/POST existed) — a
  // logged meeting could never be corrected or removed. Authorization: the meeting's own author
  // may edit/delete their entry; an ADMIN may edit/delete any (matching canArchive's ADMIN-only
  // precedent on Project — a MANAGER who didn't write the note doesn't get to alter someone
  // else's meeting record just by being in the same pole).
  async update(
    projectId: string,
    meetingId: string,
    data: { meetingDate?: Date; participants?: string; notes?: string },
    actorId: string,
    actorRole: string,
    scope?: ServiceScope
  ) {
    await assertProjectInScope(projectId, scope);
    const meeting = await projectMeetingRepository.findById(meetingId);
    if (!meeting || meeting.projectId !== projectId) throw new HttpError(404, "Meeting not found");
    if (actorRole !== "ADMIN" && meeting.createdById !== actorId) {
      throw new HttpError(403, "You can only edit your own meetings", "MEETING_NOT_YOURS");
    }
    return projectMeetingRepository.update(meetingId, data);
  },

  async delete(projectId: string, meetingId: string, actorId: string, actorRole: string, scope?: ServiceScope) {
    await assertProjectInScope(projectId, scope);
    const meeting = await projectMeetingRepository.findById(meetingId);
    if (!meeting || meeting.projectId !== projectId) throw new HttpError(404, "Meeting not found");
    if (actorRole !== "ADMIN" && meeting.createdById !== actorId) {
      throw new HttpError(403, "You can only delete your own meetings", "MEETING_NOT_YOURS");
    }
    return projectMeetingRepository.delete(meetingId);
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
