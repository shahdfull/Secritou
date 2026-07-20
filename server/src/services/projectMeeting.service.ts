import type { MeetingFrequency } from "@prisma/client";
import { projectMeetingRepository } from "../repositories/projectMeeting.repository.js";
import { assertProjectInScope, type ServiceScope } from "../utils/serviceScope.js";
import { HttpError } from "../utils/httpError.js";
import { invalidateTags } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";

// SEC-098: meeting mutations never invalidated project/client cache tags, unlike
// task.service.ts/project.service.ts which do so on every write — inconsistent, even though no
// consumer currently re-reads the projectSummary/clientSummary cache keys these tags cover (see
// ANOMALIES.yaml SEC-098 note). Fixed for consistency, not because a stale value was observed.
async function invalidateMeetingCache(projectId: string) {
  const { prismaRead: prisma } = await import("../config/prisma.js");
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { clientId: true } });
  const tags = [cacheTags.company(), cacheTags.project(projectId)];
  if (project?.clientId) tags.push(cacheTags.client(project.clientId));
  await invalidateTags(tags);
}

export const projectMeetingService = {
  async listByProject(projectId: string, scope?: ServiceScope, page?: number, pageSize?: number) {
    await assertProjectInScope(projectId, scope);
    return projectMeetingRepository.listByProject(projectId, page, pageSize);
  },

  async create(projectId: string, data: { meetingDate: Date; participants?: string; notes?: string }, createdById?: string, scope?: ServiceScope) {
    await assertProjectInScope(projectId, scope);
    const meeting = await projectMeetingRepository.create({ projectId, ...data, createdById });
    await invalidateMeetingCache(projectId);
    return meeting;
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
    const updated = await projectMeetingRepository.update(meetingId, data);
    await invalidateMeetingCache(projectId);
    return updated;
  },

  async delete(projectId: string, meetingId: string, actorId: string, actorRole: string, scope?: ServiceScope) {
    await assertProjectInScope(projectId, scope);
    const meeting = await projectMeetingRepository.findById(meetingId);
    if (!meeting || meeting.projectId !== projectId) throw new HttpError(404, "Meeting not found");
    if (actorRole !== "ADMIN" && meeting.createdById !== actorId) {
      throw new HttpError(403, "You can only delete your own meetings", "MEETING_NOT_YOURS");
    }
    const result = await projectMeetingRepository.delete(meetingId);
    await invalidateMeetingCache(projectId);
    return result;
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
