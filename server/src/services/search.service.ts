import { searchRepository } from "../repositories/search.repository.js";
import { HttpError } from "../utils/httpError.js";

export const searchService = {
  async search(companyId: string | undefined, query: string) {
    if (!companyId) {
      throw new HttpError(403, "Forbidden");
    }
    if (!query || query.trim().length < 2) {
      return { leads: [], clients: [], projects: [], tasks: [], freelancers: [] };
    }
    return searchRepository.search(companyId, query.trim());
  },
};
