import apiClient from "./axios";
import type { ApiResponse } from "../types/auth";

export interface SearchResultItem {
  id: string;
  name?: string;
  title?: string;
  email?: string;
  number?: string;
  status?: string;
  amount?: number | string;
  user?: { id: string; name: string; email: string };
}

export interface SearchResults {
  leads: SearchResultItem[];
  clients: SearchResultItem[];
  projects: SearchResultItem[];
  tasks: SearchResultItem[];
  freelancers: SearchResultItem[];
  proposals: SearchResultItem[];
  invoices: SearchResultItem[];
  serviceRequests: SearchResultItem[];
  approvals: SearchResultItem[];
}

export const searchApi = {
  search: async (query: string): Promise<SearchResults> => {
    const response = await apiClient.get<ApiResponse<SearchResults>>("/search", {
      params: { q: query },
    });
    return response.data.data;
  },
};
