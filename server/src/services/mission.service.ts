// Service for Missions - Business logic
import type {
  CreateMissionDTO,
  UpdateMissionDTO,
} from "../types/entities.js";
import { missionRepository } from "../repositories/mission.repository.js";
import { freelancerRepository } from "../repositories/freelancer.repository.js";
import { HttpError } from "../utils/httpError.js";
import type { Role, MissionStatus } from "@prisma/client";

export const missionService = {
  async getCompanyMissions(companyId: string) {
    return missionRepository.findAllByCompany(companyId);
  },

  async getOpenMissions() {
    return missionRepository.findAllOpen();
  },

  async getMissionsForUser(
    userId: string,
    userRole: Role,
    companyId?: string
  ) {
    if (userRole === "FREELANCER") {
      return missionRepository.findAllOpen();
    } else if (companyId) {
      return missionRepository.findAllByCompany(companyId);
    } else {
      throw new HttpError(403, "Forbidden");
    }
  },

  async createMission(
    companyId: string,
    data: CreateMissionDTO,
    userRole: Role
  ) {
    if (!["ADMIN", "CLIENT"].includes(userRole)) {
      throw new HttpError(403, "Only admins and clients can create missions");
    }
    return missionRepository.create({ ...data, companyId });
  },

  async updateMission(
    id: string,
    companyId: string,
    data: UpdateMissionDTO,
    userRole: Role
  ) {
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

  async applyToMission(
    missionId: string,
    userId: string,
    userRole: Role
  ) {
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
    return missionRepository.update(missionId, {
      status: "IN_PROGRESS",
      freelancerId: freelancerProfile.id,
    });
  },

  async deleteMission(
    id: string,
    companyId: string,
    userRole: Role
  ) {
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
