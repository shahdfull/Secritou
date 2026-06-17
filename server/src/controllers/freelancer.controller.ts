// Freelancer & Mission Controller - HTTP request handlers
import type { RequestHandler } from "express";
import { freelancerService } from "../services/freelancer.service.js";
import { missionService } from "../services/mission.service.js";
import { parseListQuery } from "../utils/listQuery.js";

export const getPublicFreelancers: RequestHandler = async (req, res, next) => {
  try {
    const options = parseListQuery(req.query as Record<string, unknown>);
    const result = await freelancerService.getPublicProfiles(options);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getFreelancerById: RequestHandler = async (req, res, next) => {
  try {
    const freelancer = await freelancerService.getProfile(
      req.params.id as string
    );
    res.json({ data: freelancer });
  } catch (error) {
    next(error);
  }
};

export const createMyProfile: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user?.sub!;
    const userRole = req.user?.role!;
    const profile = await freelancerService.createMyProfile(
      userId,
      userRole,
      req.body
    );
    res.status(201).json({ data: profile });
  } catch (error) {
    next(error);
  }
};

export const updateMyProfile: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user?.sub!;
    const userRole = req.user?.role!;
    const profile = await freelancerService.updateMyProfile(
      userId,
      userRole,
      req.body
    );
    res.json({ data: profile });
  } catch (error) {
    next(error);
  }
};

export const deleteMyProfile: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user?.sub!;
    const userRole = req.user?.role!;
    await freelancerService.deleteMyProfile(userId, userRole);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const getMissions: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user?.sub!;
    const userRole = req.user?.role!;
    const companyId = req.user?.companyId ?? undefined;
    const options = parseListQuery(req.query as Record<string, unknown>);
    const result = await missionService.getMissionsForUser(
      userId,
      userRole,
      companyId,
      options
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getMissionApplications: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    const applications = await missionService.getMissionApplications(
      req.params.id as string,
      companyId
    );
    res.json({ data: applications });
  } catch (error) {
    next(error);
  }
};

export const updateApplicationStatus: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    const application = await missionService.updateApplicationStatus(
      req.params.applicationId as string,
      req.body.status,
      companyId
    );
    res.json({ data: application });
  } catch (error) {
    next(error);
  }
};

export const createMission: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    const userRole = req.user?.role!;
    const mission = await missionService.createMission(
      companyId,
      req.body,
      userRole
    );
    res.status(201).json({ data: mission });
  } catch (error) {
    next(error);
  }
};

export const updateMission: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    const userRole = req.user?.role!;
    const mission = await missionService.updateMission(
      req.params.id as string,
      companyId,
      req.body,
      userRole
    );
    res.json({ data: mission });
  } catch (error) {
    next(error);
  }
};

export const applyToMission: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user?.sub!;
    const userRole = req.user?.role!;
    const mission = await missionService.applyToMission(
      req.params.id as string,
      userId,
      userRole
    );
    res.json({ data: mission });
  } catch (error) {
    next(error);
  }
};

export const deleteMission: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    const userRole = req.user?.role!;
    await missionService.deleteMission(
      req.params.id as string,
      companyId,
      userRole
    );
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
