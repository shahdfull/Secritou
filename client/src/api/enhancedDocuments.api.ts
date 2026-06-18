import apiClient from "./axios";

export interface EnhancedDocument {
  id: string;
  name: string;
  description?: string;
  type: "CONTRACT" | "DELIVERABLE" | "GUIDE" | "REPORT" | "INVOICE" | "OTHER";
  url: string;
  version: number;
  parentId?: string;
  parent?: EnhancedDocument;
  children?: EnhancedDocument[];
  tags: string[];
  accessLevel: "ADMIN_ONLY" | "ADMIN_FREELANCER" | "CLIENT_ADMIN" | "ALL";
  clientId?: string;
  companyId: string;
  projectId?: string;
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

export const enhancedDocumentsApi = {
  getDocuments: async (params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    type?: string;
    clientId?: string;
    tags?: string[];
  }) => {
    const response = await apiClient.get<{ data: PaginatedResponse<EnhancedDocument> }>(
      "/enhanced-documents",
      { params }
    );
    return response.data.data;
  },

  getDocumentById: async (id: string) => {
    const response = await apiClient.get<{ data: EnhancedDocument }>(
      `/enhanced-documents/${id}`
    );
    return response.data.data;
  },

  createDocument: async (data: {
    name: string;
    description?: string;
    type?: string;
    url: string;
    version?: number;
    tags?: string[];
    accessLevel?: string;
    clientId?: string;
    projectId?: string;
  }) => {
    const response = await apiClient.post<{ data: EnhancedDocument }>(
      "/enhanced-documents",
      data
    );
    return response.data.data;
  },

  updateDocument: async (id: string, data: Partial<EnhancedDocument>) => {
    const response = await apiClient.put<{ data: EnhancedDocument }>(
      `/enhanced-documents/${id}`,
      data
    );
    return response.data.data;
  },

  deleteDocument: async (id: string) => {
    const response = await apiClient.delete<{ data: { success: boolean } }>(
      `/enhanced-documents/${id}`
    );
    return response.data.data;
  },

  createVersion: async (id: string, data: { url: string }) => {
    const response = await apiClient.post<{ data: EnhancedDocument }>(
      `/enhanced-documents/${id}/versions`,
      data
    );
    return response.data.data;
  },
};
