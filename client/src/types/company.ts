export interface Company {
  id: string;
  name: string;
  website?: string;
  logoUrl?: string;
  primaryColor?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateCompanyInput {
  name?: string;
  website?: string;
  logoUrl?: string;
  primaryColor?: string;
}
