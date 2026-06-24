import { analyticsRepository } from "../repositories/analytics.repository.js";

export const analyticsService = {
  async getSummary(from?: Date, to?: Date, serviceId?: string | null) {
    const [leads, clients, projects, tasks, leadsByMonth, projectsByStatus, revenueByMonth] =
      await Promise.all([
        analyticsRepository.getLeadStats(from, to, serviceId),
        analyticsRepository.getClientStats(from, to, serviceId),
        analyticsRepository.getProjectStats(from, to, serviceId),
        analyticsRepository.getTaskStats(from, to, serviceId),
        analyticsRepository.getLeadsByMonth(from, to, serviceId),
        analyticsRepository.getProjectsByStatus(from, to, serviceId),
        analyticsRepository.getRevenueByMonth(from, to, serviceId),
      ]);

    return { leads, clients, projects, tasks, leadsByMonth, projectsByStatus, revenueByMonth };
  },
};
