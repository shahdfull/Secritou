import { healthBoardRepository } from "../repositories/healthBoard.repository.js";

export const healthBoardService = {
  async getHealthBoard() {
    return healthBoardRepository.getActiveProjectsHealth();
  },
};
