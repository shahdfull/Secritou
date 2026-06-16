export interface ServiceRequest {
  id: string;
  title: string;
  description?: string;
  status: "NEW" | "IN_PROGRESS" | "DONE";
  clientId: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceRequestInput {
  title: string;
  description?: string;
}
