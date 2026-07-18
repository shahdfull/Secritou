import type { MeetingFrequency } from "@prisma/client";
import { projectMeetingRepository } from "../repositories/projectMeeting.repository.js";
import { HttpError } from "../utils/httpError.js";
import type { ServiceScope } from "../utils/serviceScope.js";

// SEC (session 2026-07-18): mirrors task.service.ts's assertProjectInScope — none of this
// file's methods ever checked that the target project belongs to the calling MANAGER's own
// pole, letting a Manager list/create meetings or change the reminder cadence of a project
// outside their service, just by knowing/guessing its UUID.
async function assertProjectInScope(projectId: string, scope?: ServiceScope) {
  if (!scope || scope.userRole !== "MANAGER") return;
  const { prismaRead: prisma } = await import("../config/prisma.js");
  const project = await prisma.project.findFirst({
    where: { id: projectId, serviceId: scope.userServiceId ?? "__none__" },
    select: { id: true },
  });
  if (!project) throw new HttpError(403, "This project is not in your service", "PROJECT_OUT_OF_SCOPE");
}

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
