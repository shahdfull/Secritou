import { Router } from "express";
import * as freelancerController from "../controllers/freelancer.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createFreelancerProfileSchema,
  updateFreelancerProfileSchema,
} from "../validators/freelancer.validator.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";

const router = Router();

router.get("/", authenticate, authorize("ADMIN", "MANAGER", "FREELANCER"), freelancerController.getFreelancers);
router.get("/skills", authenticate, authorize("ADMIN", "MANAGER", "FREELANCER"), freelancerController.getSkills);

router.get(
  "/me",
  authenticate,
  authorize("FREELANCER"),
  freelancerController.getMyProfile
);

router.get("/:id", authenticate, authorize("ADMIN", "MANAGER", "FREELANCER"), freelancerController.getFreelancerById);

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
