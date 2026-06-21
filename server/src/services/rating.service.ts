import { ratingRepository } from "../repositories/rating.repository.js";
import { missionApplicationRepository } from "../repositories/missionApplication.repository.js";
import { missionRepository } from "../repositories/mission.repository.js";
import { freelancerRepository } from "../repositories/freelancer.repository.js";
import { HttpError } from "../utils/httpError.js";
import type { Role } from "@prisma/client";
import { prismaRead } from "../config/prisma.js";

export const ratingService = {
  async createRating(
    reviewerId: string,
    reviewerRole: Role,
    companyId: string | null | undefined,
    data: {
      freelancerId: string;
      missionId: string;
      score: number;
      comment?: string;
    }
  ) {
    if (reviewerRole !== "ADMIN" && reviewerRole !== "CLIENT") {
      throw new HttpError(403, "Only clients can rate freelancers");
    }

    // Verify freelancer exists
    const freelancer = await freelancerRepository.findById(data.freelancerId);
    if (!freelancer) throw new HttpError(404, "Freelancer not found");

    // Verify mission exists and belongs to reviewer's company
    const mission = await missionRepository.findById(data.missionId);
    if (!mission) throw new HttpError(404, "Mission not found");

    if (reviewerRole === "CLIENT" && companyId && mission.companyId !== companyId) {
      throw new HttpError(403, "This mission does not belong to your company");
    }

    // Mission must be completed
    if (mission.status !== "COMPLETED") {
      throw new HttpError(400, "You can only rate freelancers after a mission is completed");
    }

    // Verify the freelancer actually worked on this mission (accepted application)
    const application = await prismaRead.missionApplication.findUnique({
      where: {
        missionId_freelancerId: {
          missionId: data.missionId,
          freelancerId: data.freelancerId,
        },
      },
    });

    if (!application || application.status !== "ACCEPTED") {
      throw new HttpError(400, "This freelancer did not work on this mission");
    }

    // One rating per mission per freelancer
    const existing = await ratingRepository.findByMissionAndFreelancer(
      data.missionId,
      data.freelancerId
    );
    if (existing) {
      throw new HttpError(409, "You have already rated this freelancer for this mission");
    }

    const rating = await ratingRepository.create({
      score: data.score,
      comment: data.comment,
      freelancerId: data.freelancerId,
      missionId: data.missionId,
      applicationId: application.id,
      reviewerId,
    });

    await ratingRepository.updateFreelancerAggregates(data.freelancerId);

    return rating;
  },

  async updateRating(
    ratingId: string,
    reviewerId: string,
    reviewerRole: Role,
    companyId: string | null | undefined,
    data: { score?: number; comment?: string }
  ) {
    const rating = await ratingRepository.findById(ratingId);
    if (!rating) throw new HttpError(404, "Rating not found");

    if (rating.reviewerId !== reviewerId && reviewerRole !== "ADMIN") {
      throw new HttpError(403, "You can only edit your own ratings");
    }

    const tenantId = companyId ?? rating.mission.companyId;
    const updated = await ratingRepository.update(ratingId, tenantId, data);
    await ratingRepository.updateFreelancerAggregates(rating.freelancerId);

    return updated;
  },

  async deleteRating(
    ratingId: string,
    reviewerId: string,
    reviewerRole: Role,
    companyId: string | null | undefined
  ) {
    const rating = await ratingRepository.findById(ratingId);
    if (!rating) throw new HttpError(404, "Rating not found");

    if (rating.reviewerId !== reviewerId && reviewerRole !== "ADMIN") {
      throw new HttpError(403, "You can only delete your own ratings");
    }

    const tenantId = companyId ?? rating.mission.companyId;
    await ratingRepository.delete(ratingId, tenantId);
    await ratingRepository.updateFreelancerAggregates(rating.freelancerId);
  },

  async getFreelancerRatings(freelancerId: string, page = 1, pageSize = 10) {
    const freelancer = await freelancerRepository.findById(freelancerId);
    if (!freelancer) throw new HttpError(404, "Freelancer not found");

    const [{ data, total }, stats] = await Promise.all([
      ratingRepository.findAllByFreelancer(freelancerId, page, pageSize),
      ratingRepository.computeStats(freelancerId),
    ]);

    return { data, total, page, pageSize, stats };
  },

  async getRatingStats(freelancerId: string) {
    const freelancer = await freelancerRepository.findById(freelancerId);
    if (!freelancer) throw new HttpError(404, "Freelancer not found");
    return ratingRepository.computeStats(freelancerId);
  },

  async getRatingById(id: string) {
    const rating = await ratingRepository.findById(id);
    if (!rating) throw new HttpError(404, "Rating not found");
    return rating;
  },
};
