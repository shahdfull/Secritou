import { Router } from "express";
import { aiRateLimit } from "../middlewares/rateLimit.middleware.js";
import { chat } from "../controllers/ai.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";

const router = Router();

router.post("/chat", aiRateLimit, authenticate, authorize("ADMIN", "MANAGER"), chat);

export default router;
