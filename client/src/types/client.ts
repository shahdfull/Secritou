import type { Project } from "./project";

export interface ClientPortalUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  projects?: Project[];
  users?: ClientPortalUser[];
}

export interface CreateClientInput {
  name: string;
  email?: string;
  phone?: string;
}

export interface UpdateClientInput extends Partial<CreateClientInput> {
  id: string;
}
