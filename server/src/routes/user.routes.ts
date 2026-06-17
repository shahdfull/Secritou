import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  getUsers,
  inviteUser,
  updateUser,
  deleteUser,
  getPermissions,
} from "../controllers/user.controller.js";
import { createUserSchema, updateUserSchema } from "../validators/user.validator.js";

const router = Router();

router.use(authenticate);

router.get("/", authorize("ADMIN", "MANAGER"), getUsers);
router.post("/", authorize("ADMIN"), validate(createUserSchema), inviteUser);
router.patch("/:id", authorize("ADMIN"), validate(updateUserSchema), updateUser);
router.delete("/:id", authorize("ADMIN"), deleteUser);
router.get("/permissions", getPermissions);

export default router;
