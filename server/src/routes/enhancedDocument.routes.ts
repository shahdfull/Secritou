import express from "express";
import {
  getEnhancedDocuments,
  getEnhancedDocumentById,
  createEnhancedDocument,
  updateEnhancedDocument,
  deleteEnhancedDocument,
  createDocumentVersion,
} from "../controllers/enhancedDocument.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { requireCompanyTenant } from "../middlewares/tenant.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createEnhancedDocumentSchema,
  updateEnhancedDocumentSchema,
  createDocumentVersionSchema,
  documentIdParamSchema,
} from "../validators/enhancedDocument.validator.js";

const router = express.Router();

// Apply base middleware to all enhanced document routes
router.use(authenticate, requireCompanyTenant());

// Protected routes
router.get("/", authorize("ADMIN", "MANAGER"), getEnhancedDocuments);
router.get("/:id", validate(documentIdParamSchema), getEnhancedDocumentById);
router.post(
  "/",
  authorize("ADMIN", "MANAGER"),
  validate(createEnhancedDocumentSchema),
  createEnhancedDocument
);
router.put(
  "/:id",
  authorize("ADMIN", "MANAGER"),
  validate(updateEnhancedDocumentSchema),
  updateEnhancedDocument
);
router.delete("/:id", authorize("ADMIN"), validate(documentIdParamSchema), deleteEnhancedDocument);
router.post(
  "/:id/versions",
  authorize("ADMIN", "MANAGER"),
  validate(createDocumentVersionSchema),
  createDocumentVersion
);

export default router;
