import { healthBoardRepository } from "../repositories/healthBoard.repository.js";

export const healthBoardService = {
  async getHealthBoard(serviceId?: string) {
    return healthBoardRepository.getActiveProjectsHealth(serviceId);
  },
};
