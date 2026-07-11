import type { RequestHandler } from "express";
import { uploadService, type UploadContext } from "../services/upload.service.js";
import { createUploadMiddleware } from "../middlewares/upload.middleware.js";

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
      res
        .status(400)
        .json({ error: `Invalid upload context "${ctx}". Valid: ${VALID_CONTEXTS.join(", ")}` });
      return;
    }
    const middleware = createUploadMiddleware(ctx, "file");
    middleware(req, res, next);
  },

  async (req, res, next) => {
    try {
      const ctx = req.params.context as UploadContext;

      if (!req.file) {
        res.status(400).json({ error: "No file provided" });
        return;
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
      res.status(400).json({ error: "key is required" });
      return;
    }
    // Basic path-traversal guard
    if (key.includes("..") || key.startsWith("/")) {
      res.status(400).json({ error: "Invalid key" });
      return;
    }
    await uploadService.delete(key);
    res.json({ data: { success: true } });
  } catch (err) {
    next(err);
  }
};
