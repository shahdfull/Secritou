import express from "express";
import {
  startGscConnect,
  handleGscCallback,
  completeGscConnect,
  getGscStatus,
  disconnectGsc,
} from "../controllers/gscConnection.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { sensitiveWriteRateLimit } from "../middlewares/rateLimit.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { clientIdParamSchema, completeGscConnectSchema } from "../validators/gscConnection.validator.js";
import { getClientMetrics } from "../controllers/metricSnapshot.controller.js";

const router = express.Router();

// Google redirects here directly (no Authorization header) — must stay unauthenticated.
// Integrity is enforced by the signed `state` param (see gscConnection.service.ts).
router.get("/callback", handleGscCallback);

// Connecting a client's Search Console property is an ADMIN/MANAGER action, done on
// the client's behalf (see the correctif's chosen consent-flow owner).
router.use(authenticate, authorize("ADMIN", "MANAGER"));

router.get("/clients/:clientId/status", validate(clientIdParamSchema), getGscStatus);
router.get("/clients/:clientId/metrics", validate(clientIdParamSchema), getClientMetrics);
router.post("/clients/:clientId/connect", sensitiveWriteRateLimit, validate(clientIdParamSchema), startGscConnect);
router.post("/clients/:clientId/complete", sensitiveWriteRateLimit, validate(completeGscConnectSchema), completeGscConnect);
router.delete("/clients/:clientId", sensitiveWriteRateLimit, validate(clientIdParamSchema), disconnectGsc);

export default router;
