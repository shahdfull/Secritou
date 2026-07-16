import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/httpError.js";
import { userRepository } from "../repositories/user.repository.js";
import { enqueueNotifications } from "../jobs/queues.js";
import { notifyN8n } from "../utils/webhook.js";
import { env } from "../config/env.js";

// A rating at or below this score is treated as a quality concern worth an immediate
// external escalation (notifyN8n), not just the standard in-app notification every rating
// gets. No existing threshold for this in the codebase — chosen as "clearly negative on a
// 1-5 scale" rather than derived from a formula; revisit if it proves too noisy/quiet.
const LOW_RATING_ALERT_THRESHOLD = 2;

export const ratingService = {
  async addRating(freelancerId: string, score: number, comment?: string, ratedByUserId?: string) {
    if (score < 1 || score > 5 || !Number.isInteger(score)) {
      throw new HttpError(422, "Score must be an integer between 1 and 5");
    }

    const profile = await prisma.freelancerProfile.findUnique({ where: { id: freelancerId }, select: { id: true, userId: true, user: { select: { name: true } } } });
    if (!profile) throw new HttpError(404, "Freelancer profile not found");

    const rating = await prisma.rating.create({ data: { score, comment, freelancerId, ratedByUserId } });

    await ratingService.updateFreelancerRatingAverage(freelancerId);

    const adminUrl = `${env.FRONTEND_URL}/app/freelancers/${freelancerId}`;
    const admins = await userRepository.findAdmins();
    void enqueueNotifications(admins.map((admin) => ({
      userId: admin.id,
      title: "Nouvelle évaluation freelance",
      message: `${profile.user?.name ?? "Un freelance"} a reçu une note de ${score}/5.`,
      type: "GENERAL" as const,
      entityId: rating.id,
      link: adminUrl,
    })));

    if (score <= LOW_RATING_ALERT_THRESHOLD) {
      void notifyN8n("freelancer.rating_alert", {
        freelancerId,
        score,
        comment,
        ratedByUserId,
        adminUrl,
      });
    }

    return rating;
  },

  async getRatingsByFreelancerId(freelancerId: string) {
    return prisma.rating.findMany({
      where: { freelancerId },
      include: { ratedByUser: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
  },

  async updateFreelancerRatingAverage(freelancerId: string) {
    const ratings = await prisma.rating.findMany({ where: { freelancerId }, select: { score: true } });

    const reviewCount = ratings.length;
    const avg = reviewCount === 0 ? null : Math.round((ratings.reduce((sum, r) => sum + r.score, 0) / reviewCount) * 10) / 10;

    await prisma.freelancerProfile.update({ where: { id: freelancerId }, data: { rating: avg, reviewCount } });
  },
};
