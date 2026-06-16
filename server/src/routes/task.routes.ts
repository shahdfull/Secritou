import { Router } from "express";
import { getAllTasks, getTaskById, createTask, updateTask, deleteTask } from "../controllers/task.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createTaskSchema, updateTaskSchema } from "../validators/task.validator.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";

const router = Router();

// Apply auth middleware to all task routes
router.use(authenticate);

// Task routes
router.get("/", getAllTasks);
router.get("/:id", getTaskById);
router.post("/", validate(createTaskSchema), authorize("ADMIN"), createTask);
router.put("/:id", validate(updateTaskSchema), authorize("ADMIN"), updateTask);
router.delete("/:id", authorize("ADMIN"), deleteTask);

export default router;
