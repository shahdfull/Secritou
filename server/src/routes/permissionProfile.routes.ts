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
  createPermissionProfile,
  updatePermissionProfile,
  deletePermissionProfile,
} from "../controllers/permissionProfile.controller.js";

const router = Router();
router.use(authenticate);

router.get("/", authorize("ADMIN"), getPermissionProfiles);
router.post("/", authorize("ADMIN"), validate(createPermissionProfileSchema), createPermissionProfile);
router.patch("/:id", authorize("ADMIN"), validate(updatePermissionProfileSchema), updatePermissionProfile);
router.delete("/:id", authorize("ADMIN"), validate(deletePermissionProfileSchema), deletePermissionProfile);

export default router;
