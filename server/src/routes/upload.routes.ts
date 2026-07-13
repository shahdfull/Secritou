import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { uploadPublicRateLimit } from "../middlewares/rateLimit.middleware.js";
import {
  uploadFile,
  deleteFile,
} from "../controllers/upload.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  uploadContextParamSchema,
  deleteFileSchema,
} from "../validators/upload.validator.js";

const router = Router();

// Public upload contexts: used on the public Join-Us form : no auth required, rate-limited instead.
// "cv" and "portfolio" are both needed before a user account exists.
const PUBLIC_UPLOAD_CONTEXTS = new Set(["cv", "portfolio"]);

// POST /upload/:context : upload a file (multipart/form-data, field: "file")
// Public contexts (cv, portfolio) require no authentication but are rate-limited
// to 3 uploads/hour per IP (uploadPublicRateLimit) to prevent storage abuse.
// Protected contexts ("document", "image") require authentication.
router.post("/:context", validate(uploadContextParamSchema), (req, res, next) => {
  if (PUBLIC_UPLOAD_CONTEXTS.has(req.params.context as string)) {
    return uploadPublicRateLimit(req, res, next);
  }
  return authenticate(req, res, next);
}, ...uploadFile);

// DELETE /upload : delete a stored file by its S3 key.
// Always requires authentication — even for public-context keys (cv/, portfolio/).
// The key is returned only to the uploader; there is no legitimate unauthenticated
// delete use case, and omitting auth would allow anyone who knows a key to delete it.
router.delete("/", authenticate, validate(deleteFileSchema), deleteFile);

export default router;
