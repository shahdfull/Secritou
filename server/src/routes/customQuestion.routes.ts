import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { contactRateLimit } from "../middlewares/rateLimit.middleware.js";
import {
  createQuestion,
  getMyQuestions,
  getAllQuestions,
  getQuestionById,
  addMessage,
  updateQuestionStatus,
} from "../controllers/customQuestion.controller.js";
import {
  createCustomQuestionSchema,
  addCustomQuestionMessageSchema,
  updateCustomQuestionStatusSchema,
} from "../validators/customQuestion.validator.js";

const router = Router();

router.post("/", contactRateLimit, authenticate, validate(createCustomQuestionSchema), createQuestion);
router.get("/my", authenticate, getMyQuestions);
router.get("/", authenticate, authorize("ADMIN", "MANAGER"), getAllQuestions);
router.get("/:id", authenticate, getQuestionById);
router.post(
  "/:id/messages",
  authenticate,
  validate(addCustomQuestionMessageSchema),
  addMessage
);
router.patch(
  "/:id/status",
  authenticate,
  authorize("ADMIN", "MANAGER"),
  validate(updateCustomQuestionStatusSchema),
  updateQuestionStatus
);

export default router;
