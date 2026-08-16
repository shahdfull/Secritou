import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { getAuditLogSchema } from "../validators/auditLog.validator.js";
import { getAuditLog, getAuditLogEntityTypes } from "../controllers/auditLog.controller.js";

const router = Router();
router.use(authenticate);

// SEC-114: ADMIN-only — same pattern as permissionProfile.routes.ts (authorize("ADMIN") per
// route, no granular MANAGER permission — the audit trail spans every module by design, unlike
// the per-module MANAGER permissions in client/src/types/permissions.ts#MODULES, which this
// deliberately does not join.
router.get("/", authorize("ADMIN"), validate(getAuditLogSchema), getAuditLog);
router.get("/entity-types", authorize("ADMIN"), getAuditLogEntityTypes);

export default router;
