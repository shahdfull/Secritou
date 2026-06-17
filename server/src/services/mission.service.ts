// Service for Missions - Business logic
import type { CreateMissionDTO, UpdateMissionDTO } from "../types/entities.js";
import { missionRepository } from "../repositories/mission.repository.js";
import { missionApplicationRepository } from "../repositories/missionApplication.repository.js";
import { freelancerRepository } from "../repositories/freelancer.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { enqueueNotifications } from "../jobs/queues.js";
import { HttpError } from "../utils/httpError.js";
import type { Role, MissionApplicationStatus } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { prisma } from "../config/prisma.js";

export const missionService = {
  async getCompanyMissions(companyId: string, options: ListQueryOptions) {
    return missionRepository.findAllByCompany(companyId, options);
  },

  async getOpenMissions(options: ListQueryOptions) {
    return missionRepository.findAllOpen(options);
  },

  async getMissionsForUser(
    userId: string,
    userRole: Role,
    companyId: string | undefined,
    options: ListQueryOptions
  ) {
    if (userRole === "FREELANCER") {
      return missionRepository.findAllOpen(options);
    } else if (companyId) {
      return missionRepository.findAllByCompany(companyId, options);
    } else {
      throw new HttpError(403, "Forbidden");
    }
  },

  async getMissionApplications(missionId: string, companyId: string) {
    const mission = await missionRepository.findById(missionId);
    if (!mission) {
      throw new HttpError(404, "Mission not found");
    }
    if (mission.companyId !== companyId) {
      throw new HttpError(403, "You don't own this mission");
    }
    return missionApplicationRepository.findByMissionId(missionId);
  },

  async updateApplicationStatus(
    applicationId: string,
    status: MissionApplicationStatus,
    companyId: string
  ) {
    const application = await missionApplicationRepository.findById(applicationId);
    if (!application) {
      throw new HttpError(404, "Application not found");
    }
    if (application.mission.companyId !== companyId) {
      throw new HttpError(403, "You don't own this mission");
    }

    if (status === "ACCEPTED") {
      const [updatedApplication] = await prisma.$transaction([
        prisma.missionApplication.update({
          where: { id: applicationId },
          data: { status },
          include: {
            freelancer: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
        }),
        prisma.missionApplication.updateMany({
          where: {
            missionId: application.missionId,
            id: { not: applicationId },
            status: "PENDING",
          },
          data: { status: "REJECTED" },
        }),
        prisma.freelancerMission.update({
          where: { id: application.missionId },
          data: { status: "ASSIGNED", freelancerId: application.freelancerId },
        }),
      ]);
      return updatedApplication;
    }

    return missionApplicationRepository.updateStatus(applicationId, status);
  },

  async createMission(companyId: string, data: CreateMissionDTO, userRole: Role) {
    if (!["ADMIN", "CLIENT"].includes(userRole)) {
      throw new HttpError(403, "Only admins and clients can create missions");
    }
    return missionRepository.create({ ...data, companyId });
  },

  async updateMission(id: string, companyId: string, data: UpdateMissionDTO, userRole: Role) {
    if (!["ADMIN", "CLIENT"].includes(userRole)) {
      throw new HttpError(403, "Only admins and clients can update missions");
    }
    const mission = await missionRepository.findById(id);
    if (!mission) {
      throw new HttpError(404, "Mission not found");
    }
    if (mission.companyId !== companyId) {
      throw new HttpError(403, "You don't own this mission");
    }
    return missionRepository.update(id, data);
  },

  async applyToMission(missionId: string, userId: string, userRole: Role) {
    if (userRole !== "FREELANCER") {
      throw new HttpError(403, "Only freelancers can apply to missions");
    }
    const freelancerProfile = await freelancerRepository.findByUserId(userId);
    if (!freelancerProfile) {
      throw new HttpError(404, "Freelancer profile not found");
    }
    const mission = await missionRepository.findById(missionId);
    if (!mission) {
      throw new HttpError(404, "Mission not found");
    }
    if (mission.status !== "OPEN") {
      throw new HttpError(400, "Mission is not open for applications");
    }
    try {
      const application = await missionApplicationRepository.create({
        missionId,
        freelancerId: freelancerProfile.id,
      });

      const admins = await userRepository.findAdminsByCompanyId(mission.companyId);
      await enqueueNotifications(
        admins.map((admin) => ({
          userId: admin.id,
          title: "Nouvelle candidature",
          message: `${freelancerProfile.user.name} a postulé à la mission "${mission.title}".`,
        })),
      );

      return application;
    } catch {
      throw new HttpError(400, "You already applied to this mission");
    }
  },

  async deleteMission(id: string, companyId: string, userRole: Role) {
    if (!["ADMIN", "CLIENT"].includes(userRole)) {
      throw new HttpError(403, "Only admins and clients can delete missions");
    }
    const mission = await missionRepository.findById(id);
    if (!mission) {
      throw new HttpError(404, "Mission not found");
    }
    if (mission.companyId !== companyId) {
      throw new HttpError(403, "You don't own this mission");
    }
    return missionRepository.delete(id);
  },
};
