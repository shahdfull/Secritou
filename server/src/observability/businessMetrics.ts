import { Counter } from "prom-client";
import { registry } from "./metrics.js";

export const businessDashboardSummaryRecalculated = new Counter({
  name: "business_dashboard_summary_recalculated_total",
  help: "Nombre de recalculs de dashboard summary par tenant",
  labelNames: ["company"] as const,
  registers: [registry],
});

export const businessProjectProgressRecalculated = new Counter({
  name: "business_project_progress_recalculated_total",
  help: "Nombre de recalculs de progress project",
  registers: [registry],
});
