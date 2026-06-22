import { z } from "zod";
import {
  documentBaseSchema as sharedDocumentBase,
  documentType,
  documentAccessLevel,
} from "@secritou/shared";

const uuidParam = z.string().uuid();

export const createDocumentSchema = z.object({
  body: sharedDocumentBase,
});

export const updateDocumentSchema = z.object({
  params: z.object({ id: uuidParam }),
  body: sharedDocumentBase.partial().omit({ url: true, fileKey: true, clientId: true, projectId: true, parentId: true }),
});

export const createDocumentVersionSchema = z.object({
  params: z.object({ id: uuidParam }),
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    url: z.string().url().max(500),
    fileKey: z.string().max(500).optional(),
    description: z.string().max(2000).optional(),
  }),
});

export const documentIdParamSchema = z.object({
  params: z.object({ id: uuidParam }),
});
