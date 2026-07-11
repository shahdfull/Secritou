import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize, requirePermission } from "../middlewares/rbac.middleware.js";
import { listServices } from "../controllers/service.controller.js";
import { getTemplateForService } from "../controllers/projectTemplate.controller.js";

const router = Router();
router.use(authenticate);
// ADMIN-only: MANAGER's pole is always resolved server-side (buildServiceScope), they
// never need to pick from the full list.
router.get("/", authorize("ADMIN"), listServices);
router.get("/:serviceId/template", authorize("ADMIN", "MANAGER"), requirePermission("projects", "read"), getTemplateForService);

export default router;
