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

const router = express.Router();

// Apply base middleware to all enhanced document routes
router.use(authenticate, requireCompanyTenant());

// Protected routes
router.get("/", authorize("ADMIN", "MANAGER"), getEnhancedDocuments);
router.get("/:id", getEnhancedDocumentById);
router.post(
  "/",
  authorize("ADMIN", "MANAGER"),
  createEnhancedDocument
);
router.put(
  "/:id",
  authorize("ADMIN", "MANAGER"),
  updateEnhancedDocument
);
router.delete("/:id", authorize("ADMIN"), deleteEnhancedDocument);
router.post(
  "/:id/versions",
  authorize("ADMIN", "MANAGER"),
  createDocumentVersion
);

export default router;
