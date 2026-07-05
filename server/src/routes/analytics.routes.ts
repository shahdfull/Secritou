import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize, requirePermission } from "../middlewares/rbac.middleware.js";
import { getSummary } from "../controllers/analytics.controller.js";
import { getRevenueForecast } from "../controllers/revenueForecast.controller.js";
import { getClientProfitability } from "../controllers/clientProfitability.controller.js";
import { getGlobalTimeSummary } from "../controllers/timeEntry.controller.js";
import { getExecutiveMetrics } from "../controllers/executiveMetrics.controller.js";
import { httpCache } from "../middlewares/cache.middleware.js";
import { cacheTTL } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";
import { COMPANY_ID } from "../config/constants.js";

const router = Router();
router.use(authenticate);
router.get(
  "/summary",
  authorize("ADMIN", "MANAGER"),
  requirePermission("analytics", "read"),
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
router.get("/revenue-forecast", authorize("ADMIN"), getRevenueForecast);
router.get("/client-profitability", authorize("ADMIN"), getClientProfitability);
router.get("/time-summary", authorize("ADMIN"), getGlobalTimeSummary);
router.get("/executive", authorize("ADMIN"), getExecutiveMetrics);
export default router;
