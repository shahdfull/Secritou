import { prisma, prismaRead } from "../config/prisma.js";
import type { FreelancerRating } from "@prisma/client";

export type RatingWithRelations = FreelancerRating & {
  reviewer: { id: string; name: string };
  mission: { id: string; title: string };
};

export type RatingStats = {
  averageScore: number;
  reviewCount: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

export const ratingRepository = {
  async create(data: {
    score: number;
    comment?: string;
    freelancerId: string;
    missionId: string;
    applicationId: string;
    reviewerId: string;
  }): Promise<RatingWithRelations> {
    return prisma.freelancerRating.create({
      data,
      include: {
        reviewer: { select: { id: true, name: true } },
        mission: { select: { id: true, title: true } },
      },
    });
  },

  async update(
    id: string,
    data: { score?: number; comment?: string }
  ): Promise<RatingWithRelations> {
    return prisma.freelancerRating.update({
      where: { id },
      data,
      include: {
        reviewer: { select: { id: true, name: true } },
        mission: { select: { id: true, title: true } },
      },
    });
  },

  async delete(id: string): Promise<FreelancerRating> {
    return prisma.freelancerRating.delete({ where: { id } });
  },

  async findById(id: string): Promise<RatingWithRelations | null> {
    return prismaRead.freelancerRating.findUnique({
      where: { id },
      include: {
        reviewer: { select: { id: true, name: true } },
        mission: { select: { id: true, title: true } },
      },
    });
  },

  async findByMissionAndFreelancer(
    missionId: string,
    freelancerId: string
  ): Promise<FreelancerRating | null> {
    return prismaRead.freelancerRating.findUnique({
      where: { missionId_freelancerId: { missionId, freelancerId } },
    });
  },

  async findByApplicationId(applicationId: string): Promise<FreelancerRating | null> {
    return prismaRead.freelancerRating.findUnique({ where: { applicationId } });
  },

  async findAllByFreelancer(
    freelancerId: string,
    page = 1,
    pageSize = 10
  ): Promise<{ data: RatingWithRelations[]; total: number }> {
    const skip = (page - 1) * pageSize;
    const where = { freelancerId };
    const [data, total] = await Promise.all([
      prismaRead.freelancerRating.findMany({
        where,
        include: {
          reviewer: { select: { id: true, name: true } },
          mission: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prismaRead.freelancerRating.count({ where }),
    ]);
    return { data, total };
  },

  async computeStats(freelancerId: string): Promise<RatingStats> {
    const ratings = await prismaRead.freelancerRating.findMany({
      where: { freelancerId },
      select: { score: true },
    });

    const reviewCount = ratings.length;
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;

    if (reviewCount === 0) {
      return { averageScore: 0, reviewCount: 0, distribution };
    }

    let total = 0;
    for (const r of ratings) {
      total += r.score;
      distribution[r.score as 1 | 2 | 3 | 4 | 5]++;
    }

    const averageScore = Math.round((total / reviewCount) * 10) / 10;
    return { averageScore, reviewCount, distribution };
  },

  async updateFreelancerAggregates(freelancerId: string): Promise<void> {
    const stats = await this.computeStats(freelancerId);
    await prisma.freelancerProfile.update({
      where: { id: freelancerId },
      data: {
        rating: stats.averageScore > 0 ? String(stats.averageScore) : null,
        reviewCount: stats.reviewCount,
      },
    });
  },
};
