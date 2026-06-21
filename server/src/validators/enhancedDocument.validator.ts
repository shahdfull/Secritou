import { z } from "zod";

const uuidParam = z.string().uuid();

// Must stay in sync with EnhancedDocumentType enum in schema.prisma
const enhancedDocumentType = z.enum([
  "CONTRACT",
  "DELIVERABLE",
  "GUIDE",
  "REPORT",
  "INVOICE",
  "OTHER",
]);

// Must stay in sync with DocumentAccessLevel enum in schema.prisma
const accessLevel = z.enum([
  "ADMIN_ONLY",
  "ADMIN_FREELANCER",
  "CLIENT_ADMIN",
  "ALL",
]);

export const createEnhancedDocumentSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
    type: enhancedDocumentType.default("OTHER"),
    url: z.string().url().max(500),
    fileKey: z.string().max(500).optional(),
    tags: z.array(z.string().max(100)).max(20).default([]),
    accessLevel: accessLevel.default("CLIENT_ADMIN"),
    clientId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    parentId: z.string().uuid().optional(),
  }),
});

export const updateEnhancedDocumentSchema = z.object({
  params: z.object({ id: uuidParam }),
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).optional(),
    type: enhancedDocumentType.optional(),
    tags: z.array(z.string().max(100)).max(20).optional(),
    accessLevel: accessLevel.optional(),
  }),
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
