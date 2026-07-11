import { clientProfitabilityRepository } from "../repositories/clientProfitability.repository.js";

export const clientProfitabilityService = {
  async getProfitability(serviceId?: string) {
    return clientProfitabilityRepository.getProfitability(serviceId);
  },
};
