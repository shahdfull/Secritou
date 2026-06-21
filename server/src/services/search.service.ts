import { searchRepository, type SearchActor } from "../repositories/search.repository.js";
import { HttpError } from "../utils/httpError.js";

export const searchService = {
  async search(actor: SearchActor, query: string) {
    // Staff must belong to a company; clients/freelancers are scoped to their own entities.
    if ((actor.role === "ADMIN" || actor.role === "MANAGER") && !actor.companyId) {
      throw new HttpError(403, "Forbidden");
    }
    if (!query || query.trim().length < 2) {
      return { leads: [], clients: [], projects: [], tasks: [], freelancers: [], proposals: [], invoices: [], serviceRequests: [], approvals: [] };
    }
    if (query.trim().length > 200) {
      throw new HttpError(400, "Search query too long (max 200 characters)");
    }
    return searchRepository.search(actor, query.trim());
  },
};
