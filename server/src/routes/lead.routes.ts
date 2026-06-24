import { Router } from "express";
import * as leadController from "../controllers/lead.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createLeadSchema, updateLeadSchema } from "../validators/lead.validator.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize, requirePermission } from "../middlewares/rbac.middleware.js";
import { sensitiveWriteRateLimit } from "../middlewares/rateLimit.middleware.js";

const router = Router();
router.use(authenticate);

// ADMIN sees all leads; MANAGER is scoped to their own service (pole) in the service layer.
router.get("/", authorize("ADMIN", "MANAGER"), requirePermission("leads", "read"), leadController.getLeads);
router.get("/:id", authorize("ADMIN", "MANAGER"), requirePermission("leads", "read"), leadController.getLead);
router.post("/", authorize("ADMIN", "MANAGER"), requirePermission("leads", "create"), sensitiveWriteRateLimit, validate(createLeadSchema), leadController.createLead);
router.put("/:id", authorize("ADMIN", "MANAGER"), requirePermission("leads", "update"), validate(updateLeadSchema), leadController.updateLead);
router.delete("/:id", authorize("ADMIN"), sensitiveWriteRateLimit, leadController.deleteLead);
router.post("/:id/convert", authorize("ADMIN", "MANAGER"), requirePermission("leads", "update"), sensitiveWriteRateLimit, leadController.convertLeadToClient);

export default router;
