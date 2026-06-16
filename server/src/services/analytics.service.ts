import { analyticsRepository } from "../repositories/analytics.repository.js";

export const analyticsService = {
  async getSummary(companyId: string) {
    const [leads, clients, projects, tasks, leadsByMonth, projectsByStatus] =
      await Promise.all([
        analyticsRepository.getLeadStats(companyId),
        analyticsRepository.getClientStats(companyId),
        analyticsRepository.getProjectStats(companyId),
        analyticsRepository.getTaskStats(companyId),
        analyticsRepository.getLeadsByMonth(companyId),
        analyticsRepository.getProjectsByStatus(companyId),
      ]);

    return { leads, clients, projects, tasks, leadsByMonth, projectsByStatus };
  },
};
