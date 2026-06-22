import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/httpError.js";
import { COMPANY_ID } from "../config/constants.js";

export const ratingService = {
  async addRating(
    freelancerId: string,
    score: number,
    comment?: string,
    ratedByUserId?: string
  ) {
    if (score < 1 || score > 5 || !Number.isInteger(score)) {
      throw new HttpError(422, "Score must be an integer between 1 and 5");
    }

    const profile = await prisma.freelancerProfile.findUnique({
      where: { id: freelancerId },
      select: { id: true },
    });
    if (!profile) throw new HttpError(404, "Freelancer profile not found");

    const rating = await prisma.rating.create({
      data: { score, comment, freelancerId, ratedByUserId, companyId: COMPANY_ID },
    });

    await ratingService.updateFreelancerRatingAverage(freelancerId);

    return rating;
  },

  async updateFreelancerRatingAverage(freelancerId: string) {
    const ratings = await prisma.rating.findMany({
      where: { freelancerId },
      select: { score: true },
    });

    const reviewCount = ratings.length;
    const avg =
      reviewCount === 0
        ? null
        : Math.round((ratings.reduce((sum, r) => sum + r.score, 0) / reviewCount) * 10) / 10;

    await prisma.freelancerProfile.update({
      where: { id: freelancerId },
      data: { rating: avg, reviewCount },
    });
  },
};
