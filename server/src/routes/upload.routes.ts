import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { contactRateLimit } from "../middlewares/rateLimit.middleware.js";
import {
  uploadFile,
  deleteFile,
  getSignedUrl,
} from "../controllers/upload.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  uploadContextParamSchema,
  deleteFileSchema,
  signedUrlQuerySchema,
} from "../validators/upload.validator.js";

const router = Router();

// Public upload contexts: used on the public Join-Us form : no auth required, rate-limited instead.
// "cv" and "portfolio" are both needed before a user account exists.
const PUBLIC_UPLOAD_CONTEXTS = new Set(["cv", "portfolio"]);

// S3 key prefixes that belong to public upload contexts.
// Keys are generated as "<context>/<uuid><ext>" by buildKey(), so the prefix matches the context.
const PUBLIC_KEY_PREFIXES = ["cv/", "portfolio/"];

// POST /upload/:context : upload a file (multipart/form-data, field: "file")
// Public contexts (cv, portfolio) require no authentication but are rate-limited.
// Protected contexts ("document", "image") require authentication.
router.post("/:context", validate(uploadContextParamSchema), (req, res, next) => {
  if (PUBLIC_UPLOAD_CONTEXTS.has(req.params.context as string)) {
    return contactRateLimit(req, res, next);
  }
  return authenticate(req, res, next);
}, ...uploadFile);

// DELETE /upload : delete a stored file by its S3 key.
// Public-context keys (cv/, portfolio/) are rate-limited; all others require authentication.
router.delete("/", validate(deleteFileSchema), (req, res, next) => {
  const key = (req.body as { key?: string })?.key ?? "";
  const isPublicKey = PUBLIC_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
  if (isPublicKey) {
    return contactRateLimit(req, res, next);
  }
  return authenticate(req, res, next);
}, deleteFile);

// GET /upload/signed-url?key=...&expiresIn=3600 (protected)
router.get("/signed-url", authenticate, validate(signedUrlQuerySchema), getSignedUrl);

export default router;
