import { Router } from "express";
import * as freelancerController from "../controllers/freelancer.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createFreelancerProfileSchema,
  updateFreelancerProfileSchema,
  createMissionSchema,
  updateMissionSchema,
  updateApplicationStatusSchema,
} from "../validators/freelancer.validator.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";

const router = Router();

// Mission routes (before /:id to avoid route conflict)
router.get("/missions", authenticate, freelancerController.getMissions);
router.get(
  "/missions/:id/applications",
  authenticate,
  authorize("ADMIN", "CLIENT"),
  freelancerController.getMissionApplications
);
router.patch(
  "/missions/:id/applications/:applicationId",
  authenticate,
  authorize("ADMIN", "CLIENT"),
  validate(updateApplicationStatusSchema),
  freelancerController.updateApplicationStatus
);
router.post(
  "/missions",
  authenticate,
  authorize("ADMIN", "CLIENT"),
  validate(createMissionSchema),
  freelancerController.createMission
);
router.put(
  "/missions/:id",
  authenticate,
  authorize("ADMIN", "CLIENT"),
  validate(updateMissionSchema),
  freelancerController.updateMission
);
router.post(
  "/missions/:id/apply",
  authenticate,
  authorize("FREELANCER"),
  freelancerController.applyToMission
);
router.delete(
  "/missions/:id",
  authenticate,
  authorize("ADMIN", "CLIENT"),
  freelancerController.deleteMission
);

// Public freelancer routes
router.get("/", freelancerController.getPublicFreelancers);
router.get("/:id", freelancerController.getFreelancerById);

// Protected freelancer routes (FREELANCER only)
router.post(
  "/me",
  authenticate,
  authorize("FREELANCER"),
  validate(createFreelancerProfileSchema),
  freelancerController.createMyProfile
);
router.put(
  "/me",
  authenticate,
  authorize("FREELANCER"),
  validate(updateFreelancerProfileSchema),
  freelancerController.updateMyProfile
);
router.delete(
  "/me",
  authenticate,
  authorize("FREELANCER"),
  freelancerController.deleteMyProfile
);

export default router;
