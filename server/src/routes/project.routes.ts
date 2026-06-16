import { Router } from "express";
import { getAllProjects, getProjectById, createProject, updateProject, deleteProject } from "../controllers/project.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createProjectSchema, updateProjectSchema } from "../validators/project.validator.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";

const router = Router();

// Apply auth middleware to all project routes
router.use(authenticate);

// Project routes
router.get("/", getAllProjects);
router.get("/:id", getProjectById);
router.post("/", validate(createProjectSchema), authorize("ADMIN"), createProject);
router.put("/:id", validate(updateProjectSchema), authorize("ADMIN"), updateProject);
router.delete("/:id", authorize("ADMIN"), deleteProject);

export default router;
