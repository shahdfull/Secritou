import { Router } from "express";
import { getAllTasks, getTaskById, createTask, updateTask, deleteTask, getFreelancerAvailability } from "../controllers/task.controller.js";
import { getCommentsByTaskId, createComment, updateComment, deleteComment } from "../controllers/comment.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createTaskSchema, updateTaskSchema, getFreelancerAvailabilitySchema, addTaskCommentSchema, updateTaskCommentSchema, deleteTaskCommentSchema } from "../validators/task.validator.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize, requirePermission } from "../middlewares/rbac.middleware.js";
const router = Router();

// Apply auth middleware to all task routes
router.use(authenticate);

// Task routes. Reads are role-scoped in the repository (FREELANCER → own tasks, MANAGER → own
// service); CLIENT has no operational task access. Writes are ADMIN or MANAGER (scoped to their
// service in the service layer) : a service lead must be able to create/assign tasks.
router.get("/", authorize("ADMIN", "MANAGER", "FREELANCER"), requirePermission("tasks", "read"), getAllTasks);
// Availability check ahead of assignment — same audience as task writes (ADMIN/MANAGER assign).
router.get("/availability", authorize("ADMIN", "MANAGER"), requirePermission("tasks", "read"), validate(getFreelancerAvailabilitySchema), getFreelancerAvailability);
router.get("/:id", authorize("ADMIN", "MANAGER", "FREELANCER"), requirePermission("tasks", "read"), getTaskById);
router.post("/", authorize("ADMIN", "MANAGER"), requirePermission("tasks", "create"), validate(createTaskSchema), createTask);
router.put("/:id", authorize("ADMIN", "MANAGER", "FREELANCER"), requirePermission("tasks", "update"), validate(updateTaskSchema), updateTask);
// MANAGER can delete (unlike project deletion, which is ADMIN-only): a task is
// pole-scoped, lower-impact than the project it belongs to, and already gated by
// assertProjectInScope in task.service.ts.
router.delete("/:id", authorize("ADMIN", "MANAGER"), requirePermission("tasks", "delete"), deleteTask);

// Comment routes — comments are internal; same access as the task itself. Update/delete
// (SEC-059) additionally require, at the service layer, that the actor is the comment's own
// author or ADMIN — authorize("ADMIN","MANAGER","FREELANCER") alone would let anyone with access
// to the task edit/delete someone else's remark.
router.get("/:taskId/comments", authorize("ADMIN", "MANAGER", "FREELANCER"), getCommentsByTaskId);
router.post("/:taskId/comments", authorize("ADMIN", "MANAGER", "FREELANCER"), validate(addTaskCommentSchema), createComment);
router.put("/:taskId/comments/:commentId", authorize("ADMIN", "MANAGER", "FREELANCER"), validate(updateTaskCommentSchema), updateComment);
router.delete("/:taskId/comments/:commentId", authorize("ADMIN", "MANAGER", "FREELANCER"), validate(deleteTaskCommentSchema), deleteComment);

export default router;
