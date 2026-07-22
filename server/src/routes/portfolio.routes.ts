import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { prisma, prismaRead } from "../config/prisma.js";
import { HttpError } from "../utils/httpError.js";
import { z } from "zod";
import { validate } from "../middlewares/validate.middleware.js";
import type { RequestHandler } from "express";
import { sensitiveWriteRateLimit } from "../middlewares/rateLimit.middleware.js";

const router = Router();
router.use(authenticate, authorize("FREELANCER"));

const portfolioItemSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    url: z.string().url().optional().or(z.literal("")),
    imageUrl: z.string().url().optional().or(z.literal("")),
  }),
});

const getFreelancerId: RequestHandler = async (req, _res, next) => {
  const profile = await prismaRead.freelancerProfile.findUnique({
    where: { userId: req.user!.sub },
    select: { id: true },
  });
  if (!profile) return next(new HttpError(404, "Freelancer profile not found"));
  req.freelancerId = profile.id;
  next();
};

router.use(getFreelancerId);

router.get("/", async (req, res, next) => {
  try {
    const items = await prismaRead.portfolioItem.findMany({
      where: { freelancerId: req.freelancerId },
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: items });
  } catch (e) { next(e); }
});

router.post("/", sensitiveWriteRateLimit, validate(portfolioItemSchema), async (req, res, next) => {
  try {
    // getFreelancerId (mounted above) guarantees this is set or already errored; assert for the
    // type system so create() gets a definite string rather than string | undefined.
    if (!req.freelancerId) return next(new HttpError(404, "Freelancer profile not found"));
    const body = req.body as { title: string; description?: string; url?: string; imageUrl?: string };
    const item = await prisma.portfolioItem.create({
      data: {
        title: body.title,
        description: body.description ?? null,
        url: body.url || null,
        imageUrl: body.imageUrl || null,
        freelancerId: req.freelancerId,
      },
    });
    res.status(201).json({ data: item });
  } catch (e) { next(e); }
});

router.put("/:id", sensitiveWriteRateLimit, validate(portfolioItemSchema), async (req, res, next) => {
  try {
    const itemId = String(req.params.id);
    const existing = await prismaRead.portfolioItem.findFirst({
      where: { id: itemId, freelancerId: req.freelancerId },
    });
    if (!existing) return next(new HttpError(404, "Portfolio item not found"));
    const body = req.body as { title: string; description?: string; url?: string; imageUrl?: string };
    const item = await prisma.portfolioItem.update({
      where: { id: itemId },
      data: {
        title: body.title,
        description: body.description ?? null,
        url: body.url || null,
        imageUrl: body.imageUrl || null,
      },
    });
    res.json({ data: item });
  } catch (e) { next(e); }
});

router.delete("/:id", sensitiveWriteRateLimit, async (req, res, next) => {
  try {
    const itemId = String(req.params.id);
    const existing = await prismaRead.portfolioItem.findFirst({
      where: { id: itemId, freelancerId: req.freelancerId },
    });
    if (!existing) return next(new HttpError(404, "Portfolio item not found"));
    await prisma.portfolioItem.delete({ where: { id: itemId } });
    res.status(204).send();
  } catch (e) { next(e); }
});

export default router;
