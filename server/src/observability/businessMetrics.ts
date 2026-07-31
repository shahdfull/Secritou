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

// ── Module IA (agent-service, SEC-059 follow-up) ───────────────────────────────
// Unlike the removed agent_call_total/agent_call_duration_seconds (SEC-045, orphaned when
// agentOrchestrator.service.ts was deleted), these are wired directly into the real, live
// tool-calling loop (aiConversation.service.ts#runConversationTurn) at the moment this file
// introduces them — not ahead of a caller that doesn't exist yet.

export const aiToolCallTotal = new Counter({
  name: "ai_tool_call_total",
  help: "Nombre d'appels d'outils IA (tool calling), par outil et par résultat",
  labelNames: ["tool", "outcome"] as const,
  registers: [registry],
});

export const aiTurnRoundtrips = new Histogram({
  name: "ai_turn_roundtrips",
  help: "Nombre d'aller-retours Ollama par tour de conversation IA (borné par MAX_TOOL_ROUNDTRIPS)",
  buckets: [1, 2, 3, 4, 5],
  registers: [registry],
});

export const aiTurnDuration = new Histogram({
  name: "ai_turn_duration_seconds",
  help: "Durée totale d'un tour de conversation IA (secondes), du premier appel Ollama à la réponse finale",
  buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 180],
  registers: [registry],
});
