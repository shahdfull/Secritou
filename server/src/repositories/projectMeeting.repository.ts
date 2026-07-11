import type { MeetingFrequency } from "@prisma/client";
import { prisma, prismaRead } from "../config/prisma.js";

export const projectMeetingRepository = {
  async listByProject(projectId: string) {
    return prismaRead.projectMeeting.findMany({
      where: { projectId },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { meetingDate: "desc" },
    });
  },

  async create(data: { projectId: string; meetingDate: Date; participants?: string; notes?: string; createdById?: string }) {
    return prisma.projectMeeting.create({
      data,
      include: { createdBy: { select: { id: true, name: true } } },
    });
  },

  async setSchedule(projectId: string, frequency: MeetingFrequency, nextMeetingDate: Date | null) {
    return prisma.project.update({
      where: { id: projectId },
      data: { meetingFrequency: frequency, nextMeetingDate },
      select: { id: true, meetingFrequency: true, nextMeetingDate: true },
    });
  },

  async getSchedule(projectId: string) {
    return prismaRead.project.findUnique({
      where: { id: projectId },
      select: { id: true, meetingFrequency: true, nextMeetingDate: true },
    });
  },

  // Projects whose recurring meeting is due within [now, now + windowMs] and hasn't
  // been pushed forward yet — used by the reminder job.
  async findDueForReminder(now: Date, windowEnd: Date) {
    return prismaRead.project.findMany({
      where: {
        meetingFrequency: { not: "NONE" },
        nextMeetingDate: { not: null, gte: now, lte: windowEnd },
        archivedAt: null,
      },
      select: { id: true, name: true, clientId: true, serviceId: true, nextMeetingDate: true },
    });
  },

  // Advance nextMeetingDate to the next cadence-aligned occurrence after `from`,
  // used once a reminder has fired so the same meeting isn't reminded twice.
  async advanceToNextOccurrence(projectId: string, from: Date) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { meetingFrequency: true } });
    if (!project || project.meetingFrequency === "NONE") return;
    const next = computeNextOccurrence(from, project.meetingFrequency);
    return prisma.project.update({ where: { id: projectId }, data: { nextMeetingDate: next } });
  },
};

const FREQUENCY_DAYS: Record<Exclude<MeetingFrequency, "NONE">, number> = {
  WEEKLY: 7,
  BIWEEKLY: 14,
  MONTHLY: 30,
};

export function computeNextOccurrence(from: Date, frequency: MeetingFrequency): Date | null {
  if (frequency === "NONE") return null;
  const next = new Date(from);
  next.setDate(next.getDate() + FREQUENCY_DAYS[frequency]);
  return next;
}
