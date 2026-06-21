import { Router } from "express";
import * as leadController from "../controllers/lead.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createLeadSchema, updateLeadSchema } from "../validators/lead.validator.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { requireCompanyTenant } from "../middlewares/tenant.middleware.js";
import { sensitiveWriteRateLimit } from "../middlewares/rateLimit.middleware.js";

const router = Router();
router.use(authenticate);
router.use(authorize("ADMIN"));
router.use(requireCompanyTenant());

router.get("/", leadController.getLeads);
router.get("/:id", leadController.getLead);
router.post("/", sensitiveWriteRateLimit, validate(createLeadSchema), leadController.createLead);
router.put("/:id", validate(updateLeadSchema), leadController.updateLead);
router.delete("/:id", sensitiveWriteRateLimit, leadController.deleteLead);
router.post("/:id/convert", sensitiveWriteRateLimit, leadController.convertLeadToClient);

export default router;
