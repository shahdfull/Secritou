import { z } from "zod";

export const documentType = z.enum([
  "CONTRACT",
  "DELIVERABLE",
  "GUIDE",
  "REPORT",
  "INVOICE",
  "OTHER",
  "WELCOME_LETTER",
  "SPECS",
  "CLIENT_BRIEF",
  "QUOTE",
  "INVOICE_DEPOSIT",
  "INVOICE_BALANCE",
  "ROADMAP",
]);

export const documentAccessLevel = z.enum([
  "ADMIN_ONLY",
  "ADMIN_FREELANCER",
  "CLIENT_ADMIN",
  "ALL",
]);

export const documentBaseSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  type: documentType.default("OTHER"),
  url: z.string().url().max(500),
  fileKey: z.string().max(500).optional(),
  tags: z.array(z.string().max(100)).max(20).default([]),
  accessLevel: documentAccessLevel.default("CLIENT_ADMIN"),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
});

export const createDocumentSchema = documentBaseSchema;
export const updateDocumentSchema = documentBaseSchema.partial();

export const documentSchema = z.object({
  name: z.string().min(1),
  type: documentType,
  url: z.string().url(),
});

export type DocumentForm = z.infer<typeof documentSchema>;
