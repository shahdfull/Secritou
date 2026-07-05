import { Counter, Histogram } from "prom-client";
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

const agentCallCounter = new Counter({
  name: "agent_call_total",
  help: "Total number of agent calls",
  labelNames: ["persona_id", "success", "parsed_successfully"] as const,
  registers: [registry],
});

const agentCallDuration = new Histogram({
  name: "agent_call_duration_seconds",
  help: "Duration of agent calls in seconds",
  labelNames: ["persona_id"] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
  registers: [registry],
});

export const businessMetrics = {
  logAgentCall(
    personaId: string,
    durationMs: number,
    success: boolean,
    parsedSuccessfully: boolean
  ) {
    agentCallCounter.inc({
      persona_id: personaId,
      success: String(success),
      parsed_successfully: String(parsedSuccessfully)
    });
    agentCallDuration.observe({ persona_id: personaId }, durationMs / 1000);
  }
};
