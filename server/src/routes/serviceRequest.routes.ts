import { Router } from "express";
import { getClientServiceRequests, createClientServiceRequest, getCompanyServiceRequests, updateServiceRequest } from "../controllers/serviceRequest.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createServiceRequestSchema, updateServiceRequestSchema } from "../validators/serviceRequest.validator.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/client", authorize("CLIENT"), getClientServiceRequests);
router.post("/client", validate(createServiceRequestSchema), authorize("CLIENT"), createClientServiceRequest);
router.get("/company", authorize("ADMIN"), getCompanyServiceRequests);
router.put("/:id", validate(updateServiceRequestSchema), authorize("ADMIN"), updateServiceRequest);

export default router;
