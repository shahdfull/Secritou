import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { getSummary } from "../controllers/analytics.controller.js";
import { httpCache } from "../middlewares/cache.middleware.js";
import { cacheTTL } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";
import { COMPANY_ID } from "../config/constants.js";

const router = Router();
router.use(authenticate);
router.get(
  "/summary",
  httpCache(
    (req) => {
      const from = typeof req.query.from === "string" ? req.query.from : "";
      const to = typeof req.query.to === "string" ? req.query.to : "";
      return `cache:analytics:summary:${COMPANY_ID}:${from}:${to}`;
    },
    cacheTTL.dashboard,
    () => [cacheTags.company(), cacheTags.dashboard()],
  ),
  getSummary,
);
export default router;
