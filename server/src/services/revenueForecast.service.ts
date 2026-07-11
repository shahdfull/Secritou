import { revenueForecastRepository } from "../repositories/revenueForecast.repository.js";

export const revenueForecastService = {
  async getForecast(serviceId?: string) {
    return revenueForecastRepository.getForecast(serviceId);
  },
};
