import { searchRepository } from "../repositories/search.repository.js";
import { HttpError } from "../utils/httpError.js";

export const searchService = {
  async search(companyId: string | undefined, query: string) {
    if (!companyId) {
      throw new HttpError(403, "Forbidden");
    }
    if (!query || query.trim().length < 2) {
      return { leads: [], clients: [], projects: [], tasks: [], freelancers: [], proposals: [], invoices: [], serviceRequests: [], approvals: [] };
    }
    if (query.trim().length > 200) {
      throw new HttpError(400, "Search query too long (max 200 characters)");
    }
    return searchRepository.search(companyId, query.trim());
  },
};
