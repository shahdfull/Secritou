import api from "./axios";

export interface ForecastPeriod {
  invoicesDue: number;
  proposalsPending: number;
  projectedRevenue: number;
}

export interface RevenueForecastData {
  next30Days: ForecastPeriod;
  next60Days: ForecastPeriod;
  next90Days: ForecastPeriod;
  overdueAmount: number;
  byClient: Array<{ clientId: string; clientName: string; amount: number; invoicesDue: number }>;
}

export const revenueForecastApi = {
  getForecast: async (): Promise<RevenueForecastData> => {
    const res = await api.get<{ data: RevenueForecastData }>("/analytics/revenue-forecast");
    return res.data.data;
  },
};
