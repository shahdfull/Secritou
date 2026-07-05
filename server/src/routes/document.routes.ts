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

const router = express.Router();

// Apply base middleware to all document routes
router.use(authenticate);

// Protected routes
router.get("/", authorize("ADMIN", "MANAGER", "CLIENT", "FREELANCER"), requirePermission("documents", "read"), getDocuments);
router.get("/:id", requirePermission("documents", "read"), validate(documentIdParamSchema), getDocumentById);
router.post(
  "/",
  authorize("ADMIN", "MANAGER"),
  requirePermission("documents", "create"),
  validate(createDocumentSchema),
  createDocument
);
router.put(
  "/:id",
  authorize("ADMIN", "MANAGER"),
  requirePermission("documents", "update"),
  validate(updateDocumentSchema),
  updateDocument
);
router.delete("/:id", authorize("ADMIN"), validate(documentIdParamSchema), deleteDocument);
router.post(
  "/:id/versions",
  authorize("ADMIN", "MANAGER"),
  requirePermission("documents", "update"),
  validate(createDocumentVersionSchema),
  createDocumentVersion
);

router.patch("/:id/sign", authorize("CLIENT"), signDocument);
router.get("/:id/download", downloadDocument);

export default router;
