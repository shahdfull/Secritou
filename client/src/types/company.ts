export interface Company {
  id: string;
  name: string;
  website?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateCompanyInput {
  name?: string;
  website?: string;
}
