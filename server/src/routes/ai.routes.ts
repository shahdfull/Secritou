import { Router } from "express";
import { aiRateLimit } from "../middlewares/rateLimit.middleware.js";
import { chat, generateBrief, generateTasks } from "../controllers/ai.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { chatSchema, generateBriefSchema, generateTasksSchema } from "../validators/ai.validator.js";

const router = Router();

router.post("/chat", aiRateLimit, authenticate, authorize("ADMIN", "MANAGER"), validate(chatSchema), chat);
router.post("/brief", aiRateLimit, authenticate, authorize("ADMIN", "MANAGER"), validate(generateBriefSchema), generateBrief);
router.post("/tasks", aiRateLimit, authenticate, authorize("ADMIN", "MANAGER"), validate(generateTasksSchema), generateTasks);

export default router;
