import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import {
  getManagerPermission,
  updateManagerPermission,
  getMyPermissions,
} from "../controllers/managerPermission.controller.js";

const router = Router();
router.use(authenticate);

router.get("/me", getMyPermissions);
router.get("/:userId", authorize("ADMIN"), getManagerPermission);
router.put("/:userId", authorize("ADMIN"), updateManagerPermission);

export default router;
