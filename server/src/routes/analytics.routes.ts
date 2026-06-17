import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { getSummary } from "../controllers/analytics.controller.js";
import { httpCache } from "../middlewares/cache.middleware.js";
import { cacheTTL } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";

const router = Router();
router.use(authenticate);
router.get(
  "/summary",
  httpCache(
    (req) => {
      const companyId = req.user?.companyId ?? "unknown";
      const from = typeof req.query.from === "string" ? req.query.from : "";
      const to = typeof req.query.to === "string" ? req.query.to : "";
      return `cache:analytics:summary:${companyId}:${from}:${to}`;
    },
    cacheTTL.dashboard,
    (req) => {
      const companyId = req.user?.companyId;
      return companyId ? [cacheTags.company(companyId), cacheTags.dashboard(companyId)] : [];
    },
  ),
  getSummary,
);
export default router;
