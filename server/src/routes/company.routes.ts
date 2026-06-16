import { Router } from "express";
import { getCompany, updateCompany } from "../controllers/company.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { updateCompanySchema } from "../validators/company.validator.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";

const router = Router();

// Apply auth middleware to all company routes
router.use(authenticate);
router.use(authorize("ADMIN"));

// Company routes
router.get("/", getCompany);
router.put("/", validate(updateCompanySchema), updateCompany);

export default router;
