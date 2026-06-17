import { documentRepository } from "../repositories/document.repository.js";
import { tenantValidation } from "./tenantValidation.service.js";
import { invalidateTags } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";
import type { DocumentType } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";

export const documentService = {
  async getClientDocuments(clientId: string, companyId: string, options: ListQueryOptions) {
    await tenantValidation.assertClientInCompany(clientId, companyId);
    return documentRepository.findByClientId(clientId, companyId, options);
  },

  async createDocument(data: {
    name: string;
    type: DocumentType;
    url: string;
    companyId: string;
    projectId?: string;
    clientId?: string;
  }) {
    await tenantValidation.assertProjectAndClientInCompany(data.projectId, data.clientId, data.companyId);
    const document = await documentRepository.create(data);
    await invalidateTags([cacheTags.company(data.companyId)]);
    return document;
  },
};
