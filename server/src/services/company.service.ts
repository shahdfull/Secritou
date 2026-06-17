// Service for Companies - SaaS business logic
import { companyRepository } from "../repositories/company.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { HttpError } from "../utils/httpError.js";

import type { ListQueryOptions } from "../utils/listQuery.js";

export const companyService = {
  async getCompanyById(id: string) {
    const company = await companyRepository.findById(id);
    if (!company) throw new HttpError(404, "Company not found");
    return company;
  },

  async getCompanyUsers(companyId: string, options: ListQueryOptions) {
    return userRepository.findByCompanyId(companyId, options);
  },

  async createCompany(data: any) {
    return companyRepository.create(data);
  },

  async updateCompany(id: string, data: any) {
    const company = await companyRepository.findById(id);
    if (!company) throw new HttpError(404, "Company not found");
    return companyRepository.update(id, data);
  },

  async deleteCompany(id: string) {
    return companyRepository.delete(id);
  },
};
