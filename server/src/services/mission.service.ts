// Service for Missions - Business logic
import type { CreateMissionDTO, UpdateMissionDTO } from "../types/entities.js";
import { missionRepository } from "../repositories/mission.repository.js";
import { missionApplicationRepository } from "../repositories/missionApplication.repository.js";
import { freelancerRepository } from "../repositories/freelancer.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { enqueueNotifications } from "../jobs/queues.js";
import { HttpError } from "../utils/httpError.js";
import type { Role, MissionApplicationStatus, MissionStatus } from "@prisma/client";
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

      // Notify the freelancer that they were assigned the mission.
      const assignedUserId = updatedApplication.freelancer?.user?.id;
      if (assignedUserId) {
        await enqueueNotifications([
          {
            userId: assignedUserId,
            title: "Mission attribuée",
            message: `Votre candidature a été acceptée pour la mission "${application.mission.title}".`,
          },
        ]);
      }

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

    // Freelancer assignment must go through the application flow (updateApplicationStatus),
    // which transactionally assigns the mission and auto-rejects competing applicants.
    // Setting freelancerId directly here would bypass that, so it is not allowed.
    if (data.freelancerId !== undefined) {
      throw new HttpError(
        400,
        "Assign a freelancer by accepting their application, not by editing the mission",
        "MISSION_DIRECT_ASSIGN_FORBIDDEN"
      );
    }

    // Enforce a valid status lifecycle. Other field edits (title/description/budget) are allowed
    // without a status change.
    if (data.status !== undefined && data.status !== mission.status) {
      const allowedTransitions: Record<MissionStatus, MissionStatus[]> = {
        OPEN: ["ASSIGNED", "CANCELLED"],
        ASSIGNED: ["IN_PROGRESS", "CANCELLED"],
        IN_PROGRESS: ["COMPLETED", "CANCELLED"],
        COMPLETED: [],
        CANCELLED: [],
      };
      if (!allowedTransitions[mission.status as MissionStatus].includes(data.status)) {
        throw new HttpError(
          409,
          `Cannot move a mission from ${mission.status} to ${data.status}`,
          "INVALID_MISSION_TRANSITION"
        );
      }
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

  async markAsPaid(
    missionId: string,
    companyId: string,
    data: { paidAmount: number; paymentNote?: string }
  ) {
    const mission = await missionRepository.findById(missionId);
    if (!mission) throw new HttpError(404, "Mission not found");
    if (mission.companyId !== companyId) throw new HttpError(403, "You don't own this mission");
    if (mission.status !== "COMPLETED" && mission.status !== "ASSIGNED") {
      throw new HttpError(400, "Mission must be ASSIGNED or COMPLETED to record payment");
    }
    if (data.paidAmount <= 0) {
      throw new HttpError(422, "Payment amount must be positive");
    }
    const budget = Number(mission.budget ?? 0);
    const previousPaid = Number(mission.paidAmount ?? 0);
    // Cap the recorded paid amount at the budget (mirrors invoice payment handling). The raw
    // overpaid delta is surfaced as a warning rather than blocking, since an admin may have a
    // legitimate reason to record more than the agreed budget.
    const rawPaid = previousPaid + data.paidAmount;
    const newPaidAmount = budget > 0 ? Math.min(rawPaid, budget) : rawPaid;
    const overpaidBy = budget > 0 ? rawPaid - budget : 0;
    const paymentStatus = budget > 0 && newPaidAmount >= budget ? "PAID" : "PARTIAL";
    const mission2 = await prisma.freelancerMission.update({
      where: { id: missionId },
      data: {
        paymentStatus,
        paidAmount: newPaidAmount,
        paidAt: paymentStatus === "PAID" ? new Date() : undefined,
        paymentNote: data.paymentNote,
      },
    });
    return {
      mission: mission2,
      warning:
        overpaidBy > 0
          ? `Payment exceeds the mission budget by ${overpaidBy.toFixed(2)}`
          : undefined,
    };
  },

  async getUnpaidMissions(companyId: string, options: ListQueryOptions) {
    return missionRepository.findAllByCompany(companyId, options, {
      paymentStatus: { in: ["UNPAID", "PARTIAL"] },
      status: { in: ["ASSIGNED", "COMPLETED"] },
    });
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
