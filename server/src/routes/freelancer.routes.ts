import { Router } from "express";
import * as freelancerController from "../controllers/freelancer.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createFreelancerProfileSchema,
  updateFreelancerProfileSchema,
} from "../validators/freelancer.validator.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize, requirePermission } from "../middlewares/rbac.middleware.js";
import { sensitiveWriteRateLimit } from "../middlewares/rateLimit.middleware.js";

const router = Router();

router.get("/", authenticate, authorize("ADMIN", "MANAGER", "FREELANCER"), requirePermission("freelancers", "read"), freelancerController.getFreelancers);
router.get("/skills", authenticate, authorize("ADMIN", "MANAGER", "FREELANCER"), requirePermission("freelancers", "read"), freelancerController.getSkills);

router.get(
  "/me",
  authenticate,
  authorize("FREELANCER"),
  freelancerController.getMyProfile
);

router.get("/:id", authenticate, authorize("ADMIN", "MANAGER", "FREELANCER"), requirePermission("freelancers", "read"), freelancerController.getFreelancerById);

router.post(
  "/me",
  authenticate,
  sensitiveWriteRateLimit,
  authorize("FREELANCER"),
  validate(createFreelancerProfileSchema),
  freelancerController.createMyProfile
);

router.put(
  "/me",
  authenticate,
  sensitiveWriteRateLimit,
  authorize("FREELANCER"),
  validate(updateFreelancerProfileSchema),
  freelancerController.updateMyProfile
);

router.delete(
  "/me",
  authenticate,
  sensitiveWriteRateLimit,
  authorize("FREELANCER"),
  freelancerController.deleteMyProfile
);

export default router;
