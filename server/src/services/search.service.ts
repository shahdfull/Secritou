import { searchRepository, type SearchActor } from "../repositories/search.repository.js";

export const searchService = {
  async search(actor: SearchActor, query: string) {
    if (!query || query.trim().length < 2) {
      return { leads: [], clients: [], projects: [], tasks: [], freelancers: [], proposals: [], invoices: [], serviceRequests: [], approvals: [] };
    }
    if (query.trim().length > 200) {
      return { leads: [], clients: [], projects: [], tasks: [], freelancers: [], proposals: [], invoices: [], serviceRequests: [], approvals: [] };
    }
    return searchRepository.search(actor, query.trim());
  },
};
