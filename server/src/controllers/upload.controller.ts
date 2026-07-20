import type { RequestHandler } from "express";
import { uploadService, type UploadContext } from "../services/upload.service.js";
import { createUploadMiddleware } from "../middlewares/upload.middleware.js";
import { prismaRead } from "../config/prisma.js";
import { HttpError } from "../utils/httpError.js";

// ---------------------------------------------------------------------------
// POST /api/v1/upload/:context
// Multipart field name: "file"
// Returns: { data: { key, url, originalName, mimeType, size } }
// ---------------------------------------------------------------------------

const VALID_CONTEXTS: UploadContext[] = ["cv", "portfolio", "document", "image"];

export const uploadFile: RequestHandler[] = [
  // Dynamic multer middleware : resolve context from route param
  (req, res, next) => {
    const ctx = req.params.context as UploadContext;
    if (!VALID_CONTEXTS.includes(ctx)) {
      next(new HttpError(400, `Invalid upload context "${ctx}". Valid: ${VALID_CONTEXTS.join(", ")}`, "INVALID_UPLOAD_CONTEXT"));
      return;
    }
    const middleware = createUploadMiddleware(ctx, "file");
    middleware(req, res, next);
  },

  async (req, res, next) => {
    try {
      const ctx = req.params.context as UploadContext;

      if (!req.file) {
        throw new HttpError(400, "No file provided", "NO_FILE_PROVIDED");
      }

      const result = await uploadService.upload(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        ctx
      );

      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  },
];

// ---------------------------------------------------------------------------
// DELETE /api/v1/upload
// Body: { key: string }
// Returns: { data: { success: true } }
// ---------------------------------------------------------------------------

export const deleteFile: RequestHandler = async (req, res, next) => {
  try {
    const { key } = req.body as { key?: string };
    if (!key || typeof key !== "string") {
      throw new HttpError(400, "key is required", "MISSING_UPLOAD_KEY");
    }
    // Basic path-traversal guard
    if (key.includes("..") || key.startsWith("/")) {
      throw new HttpError(400, "Invalid key", "INVALID_UPLOAD_KEY");
    }

    const userId = req.user?.sub;
    const role = req.user?.role;

    // Ownership check: verify the caller has the right to delete this key.
    if (key.startsWith("cv/")) {
      // cv/ keys are set on FreelancerApplication (join-us form). A FREELANCER
      // can delete their own application's CV key; ADMIN/MANAGER can delete any.
      if (role === "FREELANCER") {
        const application = await prismaRead.freelancerApplication.findFirst({
          where: { cvKey: key, userId },
          select: { id: true },
        });
        if (!application) throw new HttpError(403, "You do not own this file");
      } else if (role !== "ADMIN" && role !== "MANAGER") {
        throw new HttpError(403, "Forbidden");
      }
    } else if (key.startsWith("portfolio/")) {
      // Portfolio image keys are not stored in DB — any authenticated user can
      // delete a portfolio/ key they were given (returned at upload time).
      // FREELANCER scope only; admins can also delete.
      if (role !== "FREELANCER" && role !== "ADMIN" && role !== "MANAGER") {
        throw new HttpError(403, "Forbidden");
      }
    } else if (key.startsWith("document/") || key.startsWith("image/")) {
      // Only ADMIN/MANAGER can delete document and image uploads.
      if (role !== "ADMIN" && role !== "MANAGER") {
        throw new HttpError(403, "Forbidden");
      }
    }

    await uploadService.delete(key);
    res.json({ data: { success: true } });
  } catch (err) {
    next(err);
  }
};
