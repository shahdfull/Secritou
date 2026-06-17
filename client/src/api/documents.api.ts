import apiClient from './axios';

export interface Document {
  id: string;
  name: string;
  type: 'INVOICE' | 'CONTRACT' | 'OTHER';
  url: string;
  projectId?: string;
  clientId?: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export const documentsApi = {
  getClientDocuments: async (clientId: string): Promise<Document[]> => {
    const response = await apiClient.get<{ data: Document[] }>(`/documents/client/${clientId}`);
    return response.data.data;
  },
  createDocument: async (data: {
    name: string;
    type: 'INVOICE' | 'CONTRACT' | 'OTHER';
    url: string;
    projectId?: string;
    clientId?: string;
  }): Promise<Document> => {
    const response = await apiClient.post<{ data: Document }>('/documents', data);
    return response.data.data;
  },
};
