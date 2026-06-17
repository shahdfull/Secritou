import express from "express";
import {
  getApplications,
  getApplicationById,
  createApplication,
  rejectApplication,
  acceptApplication,
} from "../controllers/freelancerApplication.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { rbacMiddleware } from "../middlewares/rbac.middleware.js";

const router = express.Router();

// Public route: create application
router.post("/", createApplication);

// Protected routes: admin only
router.get("/", authMiddleware, rbacMiddleware(["ADMIN"]), getApplications);
router.get("/:id", authMiddleware, rbacMiddleware(["ADMIN"]), getApplicationById);
router.post("/:id/reject", authMiddleware, rbacMiddleware(["ADMIN"]), rejectApplication);
router.post("/:id/accept", authMiddleware, rbacMiddleware(["ADMIN"]), acceptApplication);

export default router;
