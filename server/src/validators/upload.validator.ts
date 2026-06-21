import { z } from "zod";

// Must stay in sync with UPLOAD_CONTEXTS in upload.service.ts
const VALID_CONTEXTS = ["cv", "portfolio", "document", "image"] as const;

export const uploadContextParamSchema = z.object({
  params: z.object({
    context: z.enum(VALID_CONTEXTS),
  }),
});

export const deleteFileSchema = z.object({
  body: z.object({
    key: z.string().min(1).max(500),
  }),
});

export const signedUrlQuerySchema = z.object({
  query: z.object({
    key: z.string().min(1).max(500),
    expiresIn: z.coerce.number().int().min(60).max(604800).optional(),
  }),
});
