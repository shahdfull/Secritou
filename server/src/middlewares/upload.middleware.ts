import multer from "multer";
import type { Request } from "express";
import { UPLOAD_CONTEXTS, type UploadContext } from "../services/upload.service.js";

const MAX_FILE_SIZE = Number(process.env.UPLOAD_MAX_BYTES ?? 20 * 1024 * 1024);

// Use memory storage : we stream the buffer straight to S3
const storage = multer.memoryStorage();

function fileFilter(allowedMimes: readonly string[]) {
  return (
    _req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ) => {
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        Object.assign(
          new Error(
            `File type "${file.mimetype}" not allowed. Accepted: ${allowedMimes.join(", ")}`
          ),
          { statusCode: 415 }
        )
      );
    }
  };
}

export function createUploadMiddleware(context: UploadContext, fieldName = "file") {
  return multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: fileFilter(UPLOAD_CONTEXTS[context]),
  }).single(fieldName);
}

// Convenience instances for each context
export const uploadCv = createUploadMiddleware("cv", "file");
export const uploadPortfolio = createUploadMiddleware("portfolio", "file");
export const uploadDocument = createUploadMiddleware("document", "file");
export const uploadImage = createUploadMiddleware("image", "file");
