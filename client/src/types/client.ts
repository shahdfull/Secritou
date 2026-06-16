import type { Project } from "./project";

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;
  projects?: Project[];
}

export interface CreateClientInput {
  name: string;
  email?: string;
  phone?: string;
}

export interface UpdateClientInput extends Partial<CreateClientInput> {
  id: string;
}
