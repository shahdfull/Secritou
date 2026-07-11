import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize, requireActivatedPortal } from "../middlewares/rbac.middleware.js";
import { getClientPortalSummary, getClientPortalSeoStatus, getClientPortalSeoMetrics } from "../controllers/clientPortal.controller.js";

const router = Router();
router.use(authenticate);
router.get("/summary", authorize("CLIENT"), requireActivatedPortal, getClientPortalSummary);
router.get("/seo/status", authorize("CLIENT"), requireActivatedPortal, getClientPortalSeoStatus);
router.get("/seo/metrics", authorize("CLIENT"), requireActivatedPortal, getClientPortalSeoMetrics);

export default router;
