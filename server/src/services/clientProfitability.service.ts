import { clientProfitabilityRepository } from "../repositories/clientProfitability.repository.js";

export const clientProfitabilityService = {
  async getProfitability() {
    return clientProfitabilityRepository.getProfitability();
  },
};
