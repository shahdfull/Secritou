import { analyticsRepository } from "../repositories/analytics.repository.js";

export const analyticsService = {
  async getSummary(companyId: string, from?: Date, to?: Date) {
    const [leads, clients, projects, tasks, leadsByMonth, projectsByStatus, revenueByMonth] =
      await Promise.all([
        analyticsRepository.getLeadStats(companyId, from, to),
        analyticsRepository.getClientStats(companyId, from, to),
        analyticsRepository.getProjectStats(companyId, from, to),
        analyticsRepository.getTaskStats(companyId, from, to),
        analyticsRepository.getLeadsByMonth(companyId, from, to),
        analyticsRepository.getProjectsByStatus(companyId, from, to),
        analyticsRepository.getRevenueByMonth(companyId, from, to),
      ]);

    return { leads, clients, projects, tasks, leadsByMonth, projectsByStatus, revenueByMonth };
  },
};
