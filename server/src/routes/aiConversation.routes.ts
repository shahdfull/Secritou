import { Router } from "express";
import {
  listConversations,
  getConversation,
  createConversation,
  addMessage,
  deleteConversation,
  importFromLocalStorage,
} from "../controllers/aiConversation.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { requireCompanyTenant } from "../middlewares/tenant.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { aiRateLimit } from "../middlewares/rateLimit.middleware.js";
import {
  createConversationSchema,
  addMessageSchema,
  deleteConversationSchema,
  importSchema,
} from "../validators/aiConversation.validator.js";

const router = Router();
router.use(authenticate, authorize("ADMIN", "MANAGER"), requireCompanyTenant());

router.get("/", listConversations);
router.post("/", aiRateLimit, validate(createConversationSchema), createConversation);
router.post("/import", validate(importSchema), importFromLocalStorage);
router.get("/:id", validate(deleteConversationSchema), getConversation);
router.post("/:id/messages", aiRateLimit, validate(addMessageSchema), addMessage);
router.delete("/:id", validate(deleteConversationSchema), deleteConversation);

export default router;
