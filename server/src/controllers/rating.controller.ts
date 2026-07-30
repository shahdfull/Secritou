import type { Request, Response } from "express";
import { ratingService } from "../services/rating.service.js";
import { HttpError } from "../utils/httpError.js";
import { prisma } from "../config/prisma.js";
import { buildServiceScope } from "../utils/serviceScope.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getRatings = async (req: Request, res: Response) => {
  const freelancerId = req.params.freelancerId as string;
  if (!UUID_RE.test(freelancerId)) throw new HttpError(400, "Invalid freelancer id");

  // FREELANCERs may only read their own ratings
  if (req.user!.role === "FREELANCER") {
    const profile = await prisma.freelancerProfile.findUnique({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (!profile || profile.id !== freelancerId) {
      throw new HttpError(403, "You can only view your own ratings");
    }
  }

  const scope = req.user!.role === "MANAGER" ? await buildServiceScope(req) : undefined;
  const ratings = await ratingService.getRatingsByFreelancerId(freelancerId, scope?.userServiceId);
  res.json({ data: ratings });
};

export const addRating = async (req: Request, res: Response) => {
  const freelancerId = req.params.freelancerId as string;
  if (!UUID_RE.test(freelancerId)) throw new HttpError(400, "Invalid freelancer id");

  const { score, comment } = req.body as { score: number; comment?: string };
  const scope = req.user!.role === "MANAGER" ? await buildServiceScope(req) : undefined;
  const rating = await ratingService.addRating(freelancerId, score, comment, req.user!.id, scope?.userServiceId);
  res.status(201).json({ data: rating });
};
