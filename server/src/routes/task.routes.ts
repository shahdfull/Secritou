import { Router } from "express";
import { getAllTasks, getTaskById, createTask, updateTask, deleteTask } from "../controllers/task.controller.js";
import { getCommentsByTaskId, createComment } from "../controllers/comment.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createTaskSchema, updateTaskSchema } from "../validators/task.validator.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize, requirePermission } from "../middlewares/rbac.middleware.js";
const router = Router();

// Apply auth middleware to all task routes
router.use(authenticate);

// Task routes. Reads are role-scoped in the repository (FREELANCER → own tasks, MANAGER → own
// service); CLIENT has no operational task access. Writes are ADMIN or MANAGER (scoped to their
// service in the service layer) : a service lead must be able to create/assign tasks.
router.get("/", authorize("ADMIN", "MANAGER", "FREELANCER"), requirePermission("tasks", "read"), getAllTasks);
router.get("/:id", authorize("ADMIN", "MANAGER", "FREELANCER"), requirePermission("tasks", "read"), getTaskById);
router.post("/", authorize("ADMIN", "MANAGER"), requirePermission("tasks", "create"), validate(createTaskSchema), createTask);
router.put("/:id", authorize("ADMIN", "MANAGER"), requirePermission("tasks", "update"), validate(updateTaskSchema), updateTask);
router.delete("/:id", authorize("ADMIN", "MANAGER"), requirePermission("tasks", "delete"), deleteTask);

// Comment routes — comments are internal; same access as the task itself
router.get("/:taskId/comments", authorize("ADMIN", "MANAGER", "FREELANCER"), getCommentsByTaskId);
router.post("/:taskId/comments", authorize("ADMIN", "MANAGER", "FREELANCER"), createComment);

export default router;
