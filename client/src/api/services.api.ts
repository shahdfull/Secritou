import apiClient from "./axios";

export interface ServiceItem {
  id: string;
  name: string;
}

export const servicesApi = {
  getServices: async (): Promise<ServiceItem[]> => {
    const response = await apiClient.get<{ data: ServiceItem[] }>("/services");
    return response.data.data;
  },
};
