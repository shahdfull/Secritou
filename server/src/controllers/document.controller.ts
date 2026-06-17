import type { RequestHandler } from 'express';
import { documentService } from '../services/document.service.js';
import { parseListQuery } from '../utils/listQuery.js';
import { z } from 'zod';

const createDocumentSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['INVOICE', 'CONTRACT', 'OTHER']),
  url: z.string().url(),
  projectId: z.string().optional(),
  clientId: z.string().optional(),
});

export const getClientDocuments: RequestHandler = async (req, res, next) => {
  try {
    const clientId = req.params.clientId as string;
    const companyId = req.user?.companyId as string;
    const options = parseListQuery(req.query as Record<string, unknown>);
    const result = await documentService.getClientDocuments(clientId, companyId, options);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const createDocument: RequestHandler = async (req, res, next) => {
  try {
    const data = createDocumentSchema.parse(req.body);
    const companyId = req.user?.companyId as string;
    const document = await documentService.createDocument({ ...data, companyId });
    res.json({ data: document });
  } catch (error) {
    next(error);
  }
};
