import type { RequestHandler } from "express";
import type { MeetingFrequency } from "@prisma/client";
import { projectMeetingService } from "../services/projectMeeting.service.js";
import { buildServiceScope } from "../utils/serviceScope.js";

export const listProjectMeetings: RequestHandler = async (req, res, next) => {
  try {
    const scope = await buildServiceScope(req);
    // SEC-055 (F6): page/pageSize are optional — only applied when both are present and valid, so
    // an unpaginated call (none of today's other callers pass these) behaves exactly as before.
    const page = Number(req.query.page);
    const pageSize = Number(req.query.pageSize);
    const hasPagination = Number.isInteger(page) && page > 0 && Number.isInteger(pageSize) && pageSize > 0;
    const result = await projectMeetingService.listByProject(
      req.params.id as string,
      scope,
      hasPagination ? page : undefined,
      hasPagination ? Math.min(pageSize, 50) : undefined
    );
    res.json({ data: result.data, total: result.total });
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

export const updateProjectMeeting: RequestHandler = async (req, res, next) => {
  try {
    const scope = await buildServiceScope(req);
    const { meetingDate, participants, notes } = req.body as { meetingDate?: string; participants?: string; notes?: string };
    const meeting = await projectMeetingService.update(
      req.params.id as string,
      req.params.meetingId as string,
      { meetingDate: meetingDate ? new Date(meetingDate) : undefined, participants, notes },
      req.user!.sub,
      req.user!.role,
      scope
    );
    res.json({ data: meeting });
  } catch (err) {
    next(err);
  }
};

export const deleteProjectMeeting: RequestHandler = async (req, res, next) => {
  try {
    const scope = await buildServiceScope(req);
    await projectMeetingService.delete(
      req.params.id as string,
      req.params.meetingId as string,
      req.user!.sub,
      req.user!.role,
      scope
    );
    res.status(204).send();
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
