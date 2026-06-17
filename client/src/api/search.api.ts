import apiClient from "./axios";
import type { ApiResponse } from "../types/auth";

export interface SearchResultItem {
  id: string;
  name?: string;
  title?: string;
  email?: string;
  user?: { id: string; name: string; email: string };
}

export interface SearchResults {
  leads: SearchResultItem[];
  clients: SearchResultItem[];
  projects: SearchResultItem[];
  tasks: SearchResultItem[];
  freelancers: SearchResultItem[];
}

export const searchApi = {
  search: async (query: string): Promise<SearchResults> => {
    const response = await apiClient.get<ApiResponse<SearchResults>>("/search", {
      params: { q: query },
    });
    return response.data.data;
  },
};
