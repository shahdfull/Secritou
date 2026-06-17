import { Router } from "express";
import { getClientServiceRequests, createClientServiceRequest, getCompanyServiceRequests, updateServiceRequest } from "../controllers/serviceRequest.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createServiceRequestSchema, updateServiceRequestSchema } from "../validators/serviceRequest.validator.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { requireClientTenant, requireCompanyTenant } from "../middlewares/tenant.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/client", authorize("CLIENT"), requireClientTenant(), getClientServiceRequests);
router.post("/client", authorize("CLIENT"), requireClientTenant(), validate(createServiceRequestSchema), createClientServiceRequest);
router.get("/company", authorize("ADMIN"), requireCompanyTenant(), getCompanyServiceRequests);
router.put("/:id", authorize("ADMIN"), requireCompanyTenant(), validate(updateServiceRequestSchema), updateServiceRequest);

export default router;
