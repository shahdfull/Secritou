import { Router } from "express";
import { getCompany, getCompanyUsers, updateCompany } from "../controllers/company.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { updateCompanySchema } from "../validators/company.validator.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";

const router = Router();

// Apply auth middleware to all company routes
router.use(authenticate);

// Company routes
router.get("/", authorize("ADMIN"), getCompany);
router.get("/users", authorize("ADMIN"), getCompanyUsers);
router.put("/", authorize("ADMIN"), validate(updateCompanySchema), updateCompany);

export default router;
