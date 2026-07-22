import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createPermissionProfileSchema,
  updatePermissionProfileSchema,
  deletePermissionProfileSchema,
} from "../validators/permissionProfile.validator.js";
import {
  getPermissionProfiles,
  getPermissionProfileDeleteImpact,
  createPermissionProfile,
  updatePermissionProfile,
  deletePermissionProfile,
} from "../controllers/permissionProfile.controller.js";
import { sensitiveWriteRateLimit } from "../middlewares/rateLimit.middleware.js";

const router = Router();
router.use(authenticate);

router.get("/", authorize("ADMIN"), getPermissionProfiles);
router.get("/:id/delete-impact", authorize("ADMIN"), getPermissionProfileDeleteImpact);
router.post("/", sensitiveWriteRateLimit, authorize("ADMIN"), validate(createPermissionProfileSchema), createPermissionProfile);
router.patch("/:id", sensitiveWriteRateLimit, authorize("ADMIN"), validate(updatePermissionProfileSchema), updatePermissionProfile);
router.delete("/:id", sensitiveWriteRateLimit, authorize("ADMIN"), validate(deletePermissionProfileSchema), deletePermissionProfile);

export default router;
