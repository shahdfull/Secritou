import api from "./axios";

export interface AnalyticsEventSummary {
  total: number;
  byName: { name: string; count: number }[];
  eventsByMonth: { month: string; count: number }[];
  topPages: { pagePath: string; count: number }[];
  funnels: {
    ctaToContact: {
      ctaClicked: number;
      contactFormSubmitted: number;
      contactFormFailed: number;
      conversionRate: number;
    };
  };
}

export const analyticsEventApi = {
  getSummary: async (from?: string, to?: string): Promise<AnalyticsEventSummary> => {
    const res = await api.get<{ data: AnalyticsEventSummary }>("/analytics/events/summary", {
      params: { from, to },
    });
    return res.data.data;
  },
};
