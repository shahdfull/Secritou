import { Router } from "express";
import { contactRateLimit, sensitiveWriteRateLimit } from "../middlewares/rateLimit.middleware.js";
import { submitContactRequest, getContactRequests, updateContactRequest, convertToLead } from "../controllers/contact.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { contactRequestSchema } from "../validators/contact.validator.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
export const contactRoutes = Router();

contactRoutes.post("/", contactRateLimit, validate(contactRequestSchema), submitContactRequest);
contactRoutes.get("/", authenticate, authorize("ADMIN"), getContactRequests);
contactRoutes.patch("/:id", authenticate, authorize("ADMIN"), sensitiveWriteRateLimit, updateContactRequest);
contactRoutes.post("/:id/convert-to-lead", authenticate, authorize("ADMIN", "MANAGER"), sensitiveWriteRateLimit, convertToLead);
