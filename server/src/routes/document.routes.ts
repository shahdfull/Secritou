import express from "express";
import {
  getDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
  createDocumentVersion,
  signDocument,
  downloadDocument,
} from "../controllers/document.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize, requirePermission } from "../middlewares/rbac.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createDocumentSchema,
  updateDocumentSchema,
  createDocumentVersionSchema,
  documentIdParamSchema,
} from "../validators/document.validator.js";
import { sensitiveWriteRateLimit } from "../middlewares/rateLimit.middleware.js";

const router = express.Router();

// Apply base middleware to all document routes
router.use(authenticate);

// Not gated by requireActivatedPortal: the client must be able to view/sign the contract and
// quote before the deposit is paid — that's the whole point of the payment step.
router.get("/", authorize("ADMIN", "MANAGER", "CLIENT", "FREELANCER"), requirePermission("documents", "read"), getDocuments);
router.get(
  "/:id",
  authorize("ADMIN", "MANAGER", "CLIENT", "FREELANCER"),
  requirePermission("documents", "read"),
  validate(documentIdParamSchema),
  getDocumentById
);
// SEC-063: FREELANCER added — ProjectDetailPage.tsx's "Mes livrables" tab already called this
// route, but it always 403'd before reaching requirePermission (never actually reachable). The
// service layer (documentService.create) restricts a FREELANCER to depositing their own
// DELIVERABLE on a project they're staffed on — this authorize() alone doesn't cover that.
router.post(
  "/",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER", "FREELANCER"),
  requirePermission("documents", "create"),
  validate(createDocumentSchema),
  createDocument
);
router.put(
  "/:id",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("documents", "update"),
  validate(updateDocumentSchema),
  updateDocument
);
router.delete("/:id", sensitiveWriteRateLimit, authorize("ADMIN"), validate(documentIdParamSchema), deleteDocument);
router.post(
  "/:id/versions",
  sensitiveWriteRateLimit,
  authorize("ADMIN", "MANAGER"),
  requirePermission("documents", "update"),
  validate(createDocumentVersionSchema),
  createDocumentVersion
);

router.patch("/:id/sign", sensitiveWriteRateLimit, authorize("CLIENT"), signDocument);
router.get(
  "/:id/download",
  authorize("ADMIN", "MANAGER", "CLIENT", "FREELANCER"),
  validate(documentIdParamSchema),
  downloadDocument
);

export default router;
