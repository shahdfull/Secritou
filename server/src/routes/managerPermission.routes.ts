import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { updateManagerPermissionSchema } from "../validators/managerPermission.validator.js";
import {
  getManagerPermission,
  updateManagerPermission,
  getMyPermissions,
} from "../controllers/managerPermission.controller.js";
import { sensitiveWriteRateLimit } from "../middlewares/rateLimit.middleware.js";

const router = Router();
router.use(authenticate);

router.get("/me", getMyPermissions);
router.get("/:userId", authorize("ADMIN"), getManagerPermission);
router.put("/:userId", sensitiveWriteRateLimit, authorize("ADMIN"), validate(updateManagerPermissionSchema), updateManagerPermission);

export default router;
