import { Router } from "express";
import * as freelancerController from "../controllers/freelancer.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createFreelancerProfileSchema,
  updateFreelancerProfileSchema,
  createMissionSchema,
  updateMissionSchema,
} from "../validators/freelancer.validator.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";

const router = Router();

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

// Mission routes
router.get("/missions", authenticate, freelancerController.getMissions);
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

export default router;
