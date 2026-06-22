import { analyticsRepository } from "../repositories/analytics.repository.js";
import { COMPANY_ID } from "../config/constants.js";

export const analyticsService = {
  async getSummary(from?: Date, to?: Date) {
    const [leads, clients, projects, tasks, leadsByMonth, projectsByStatus, revenueByMonth] =
      await Promise.all([
        analyticsRepository.getLeadStats(COMPANY_ID, from, to),
        analyticsRepository.getClientStats(COMPANY_ID, from, to),
        analyticsRepository.getProjectStats(COMPANY_ID, from, to),
        analyticsRepository.getTaskStats(COMPANY_ID, from, to),
        analyticsRepository.getLeadsByMonth(COMPANY_ID, from, to),
        analyticsRepository.getProjectsByStatus(COMPANY_ID, from, to),
        analyticsRepository.getRevenueByMonth(COMPANY_ID, from, to),
      ]);

    return { leads, clients, projects, tasks, leadsByMonth, projectsByStatus, revenueByMonth };
  },
};
