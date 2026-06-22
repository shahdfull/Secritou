import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import {
  getPermissionProfiles,
  createPermissionProfile,
  updatePermissionProfile,
  deletePermissionProfile,
} from "../controllers/permissionProfile.controller.js";

const router = Router();
router.use(authenticate);

router.get("/", authorize("ADMIN"), getPermissionProfiles);
router.post("/", authorize("ADMIN"), createPermissionProfile);
router.patch("/:id", authorize("ADMIN"), updatePermissionProfile);
router.delete("/:id", authorize("ADMIN"), deletePermissionProfile);

export default router;
