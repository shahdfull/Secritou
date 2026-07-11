import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize, requirePermission } from "../middlewares/rbac.middleware.js";
import { getSummary } from "../controllers/analytics.controller.js";
import { getRevenueForecast } from "../controllers/revenueForecast.controller.js";
import { getClientProfitability } from "../controllers/clientProfitability.controller.js";
import { getGlobalTimeSummary, getWorkload } from "../controllers/timeEntry.controller.js";
import { getExecutiveMetrics } from "../controllers/executiveMetrics.controller.js";
import { httpCache } from "../middlewares/cache.middleware.js";
import { cacheTTL } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";
import { COMPANY_ID } from "../config/constants.js";
import { buildServiceScope } from "../utils/serviceScope.js";

const router = Router();
router.use(authenticate);
router.get(
  "/summary",
  authorize("ADMIN", "MANAGER"),
  requirePermission("analytics", "read"),
  httpCache(
    async (req) => {
      const from = typeof req.query.from === "string" ? req.query.from : "";
      const to = typeof req.query.to === "string" ? req.query.to : "";
      const scope = await buildServiceScope(req);
      const serviceIdPart = scope.userServiceId || "admin";
      return `cache:analytics:summary:${COMPANY_ID}:${serviceIdPart}:${from}:${to}`;
    },
    cacheTTL.dashboard,
    () => [cacheTags.company(), cacheTags.dashboard()],
  ),
  getSummary,
);
router.get("/revenue-forecast", authorize("ADMIN", "MANAGER"), requirePermission("analytics", "read"), getRevenueForecast);
router.get("/client-profitability", authorize("ADMIN", "MANAGER"), requirePermission("analytics", "read"), getClientProfitability);
router.get("/time-summary", authorize("ADMIN", "MANAGER"), requirePermission("analytics", "read"), getGlobalTimeSummary);
router.get("/workload", authorize("ADMIN", "MANAGER"), requirePermission("analytics", "read"), getWorkload);
router.get("/executive", authorize("ADMIN", "MANAGER"), requirePermission("analytics", "read"), getExecutiveMetrics);
export default router;
