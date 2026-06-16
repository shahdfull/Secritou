import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { getSummary } from "../controllers/analytics.controller.js";

const router = Router();
router.use(authenticate);
router.get("/summary", getSummary);
export default router;
