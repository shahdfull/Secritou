import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { upsertSiteContentSchema } from "../validators/siteContent.validator.js";
import {
  getPublicSiteContent,
  getGroupedSiteContent,
  upsertSiteContent,
} from "../controllers/siteContent.controller.js";
import { sensitiveWriteRateLimit } from "../middlewares/rateLimit.middleware.js";

export const siteContentPublicRoutes = Router();
export const siteContentAdminRoutes = Router();

// Public - no auth (feeds the public landing page)
siteContentPublicRoutes.get("/", getPublicSiteContent);

// Admin - ADMIN role only
siteContentAdminRoutes.get("/", authenticate, authorize("ADMIN"), getGroupedSiteContent);
siteContentAdminRoutes.put("/", authenticate, sensitiveWriteRateLimit, authorize("ADMIN"), validate(upsertSiteContentSchema), upsertSiteContent);
