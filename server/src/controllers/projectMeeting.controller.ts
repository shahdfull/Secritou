import type { RequestHandler } from "express";
import type { MeetingFrequency } from "@prisma/client";
import { projectMeetingService } from "../services/projectMeeting.service.js";
import { buildServiceScope } from "../utils/serviceScope.js";

export const listProjectMeetings: RequestHandler = async (req, res, next) => {
  try {
    const scope = await buildServiceScope(req);
    const data = await projectMeetingService.listByProject(req.params.id as string, scope);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const createProjectMeeting: RequestHandler = async (req, res, next) => {
  try {
    const scope = await buildServiceScope(req);
    const { meetingDate, participants, notes } = req.body as { meetingDate: string; participants?: string; notes?: string };
    const meeting = await projectMeetingService.create(
      req.params.id as string,
      { meetingDate: new Date(meetingDate), participants, notes },
      req.user!.sub,
      scope
    );
    res.status(201).json({ data: meeting });
  } catch (err) {
    next(err);
  }
};

export const getMeetingSchedule: RequestHandler = async (req, res, next) => {
  try {
    const scope = await buildServiceScope(req);
    const data = await projectMeetingService.getSchedule(req.params.id as string, scope);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const updateMeetingSchedule: RequestHandler = async (req, res, next) => {
  try {
    const scope = await buildServiceScope(req);
    const { frequency, nextMeetingDate } = req.body as { frequency: MeetingFrequency; nextMeetingDate?: string };
    const data = await projectMeetingService.setSchedule(
      req.params.id as string,
      frequency,
      nextMeetingDate ? new Date(nextMeetingDate) : null,
      scope
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
};
