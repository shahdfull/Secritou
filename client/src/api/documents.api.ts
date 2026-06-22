import apiClient from "./axios";

export type DocumentType = "WELCOME_LETTER" | "CONTRACT" | "SPECS" | "CLIENT_BRIEF" | "QUOTE" | "INVOICE_DEPOSIT" | "INVOICE_BALANCE" | "ROADMAP";
export type EnhancedDocumentType = "CONTRACT" | "DELIVERABLE" | "GUIDE" | "REPORT" | "INVOICE" | "OTHER";

export interface Document {
  id: string;
  name: string;
  title: string;
  description?: string;
  type: DocumentType;
  enhancedType: EnhancedDocumentType;
  url: string;
  fileUrl?: string;
  fileKey?: string;
  version: number;
  parentId?: string;
  parent?: Document;
  children?: Document[];
  tags: string[];
  accessLevel: "ADMIN_ONLY" | "ADMIN_FREELANCER" | "CLIENT_ADMIN" | "ALL";
  clientId?: string;
  companyId: string;
  projectId?: string;
  uploadedById: string;
  signedAt?: string;
  signedByClientId?: string;
  client?: { name: string };
  accessLog?: DocumentAccessLog[];
  createdAt: string;
  updatedAt: string;
}

export interface DocumentAccessLog {
  id: string;
  action: string;
  userId?: string;
  user?: { name: string };
  documentId: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const documentsApi = {
  getDocuments: async (params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    type?: DocumentType;
    enhancedType?: EnhancedDocumentType;
    clientId?: string;
    projectId?: string;
    tags?: string[];
  }) => {
    const response = await apiClient.get<{ data: PaginatedResponse<Document> }>(
      "/documents",
      { params }
    );
    return response.data.data;
  },

  getDocumentById: async (id: string) => {
    const response = await apiClient.get<{ data: Document }>(
      `/documents/${id}`
    );
    return response.data.data;
  },

  createDocument: async (data: {
    name: string;
    title: string;
    description?: string;
    type?: DocumentType;
    enhancedType?: EnhancedDocumentType;
    url: string;
    fileUrl?: string;
    fileKey?: string;
    version?: number;
    tags?: string[];
    accessLevel?: string;
    clientId?: string;
    projectId?: string;
  }) => {
    const response = await apiClient.post<{ data: Document }>(
      "/documents",
      data
    );
    return response.data.data;
  },

  updateDocument: async (id: string, data: Partial<Document>) => {
    const response = await apiClient.put<{ data: Document }>(
      `/documents/${id}`,
      data
    );
    return response.data.data;
  },

  deleteDocument: async (id: string) => {
    const response = await apiClient.delete<{ data: { success: boolean } }>(
      `/documents/${id}`
    );
    return response.data.data;
  },

  createVersion: async (id: string, data: { url: string }) => {
    const response = await apiClient.post<{ data: Document }>(
      `/documents/${id}/versions`,
      data
    );
    return response.data.data;
  },

  signDocument: async (id: string) => {
    const response = await apiClient.patch<{ data: Document }>(`/documents/${id}/sign`);
    return response.data.data;
  },

  getDownloadUrl: async (id: string) => {
    const response = await apiClient.get<{ data: { url: string; filename: string } }>(`/documents/${id}/download`);
    return response.data.data;
  },
};
