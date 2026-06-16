// Service for Companies - SaaS business logic
import { companyRepository } from "../repositories/company.repository.js";
import { HttpError } from "../utils/httpError.js";

export const companyService = {
  async getCompanyById(id: string) {
    const company = await companyRepository.findById(id);
    if (!company) throw new HttpError(404, "Company not found");
    return company;
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
