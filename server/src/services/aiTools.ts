// SEC-059: gives the AI assistant real read access to CRM data (Lead/Client/Project/Task/
// Freelancer) via Ollama tool calling. Every scoping decision is delegated to the same
// service/repository the equivalent REST endpoint already uses (leadService, clientService,
// projectService, taskService, freelancerService) — never a parallel query path, and never a
// second scoping rule reimplemented here (a tool that re-derives its own filter instead of
// forwarding the caller's raw scope can silently diverge from the REST behavior it claims to
// mirror). Read-only: no create/update/delete tool is exposed here.
import type { LeadStatus, Priority, ProjectStatus, TaskStatus } from "@prisma/client";
import { leadService } from "./lead.service.js";
import { clientService } from "./client.service.js";
import { projectService } from "./project.service.js";
import { taskService } from "./task.service.js";
import { freelancerService } from "./freelancer.service.js";
import { dashboardService } from "./dashboard.service.js";
import { executiveMetricsService } from "./executiveMetrics.service.js";
import { timeEntryService } from "./timeEntry.service.js";
import type { ServiceScope } from "../utils/serviceScope.js";
import type { LeadScope } from "../repositories/lead.repository.js";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { HttpError } from "../utils/httpError.js";

// Reuses ServiceScope as-is (same shape buildServiceScope already produces from a request) rather
// than declaring a near-identical type that would drift from it — the caller context for tool
// calling is exactly the same role/pole scope every REST endpoint already uses.
export type AiToolCallerContext = ServiceScope;

// Capped well below any REST endpoint's own maxPageSize — this payload is serialized into the
// LLM's context window, not rendered in a paginated UI table. 20 rows is enough for the assistant
// to answer "what are my open leads" without risking an oversized prompt on a large pipeline.
const TOOL_LIST_PAGE_SIZE = 20;

function baseListOptions(search?: string, status?: string): ListQueryOptions {
  return { page: 1, pageSize: TOOL_LIST_PAGE_SIZE, orderDir: "desc", search, status };
}

// A tool result capped at TOOL_LIST_PAGE_SIZE with no signal that more rows exist reads to the
// model as a complete, exhaustive answer — it will confidently say "your leads are: ..." listing
// 20 names as if that were all of them. `truncated` makes the cutoff explicit in the payload
// itself, and SYSTEM_PROMPT instructs the model to say so rather than silently presenting a
// partial list as the whole picture.
function withTruncation<T extends { total: number }>(result: T): T & { truncated: boolean } {
  return { ...result, truncated: result.total > TOOL_LIST_PAGE_SIZE };
}

function toServiceScope(ctx: AiToolCallerContext): ServiceScope {
  return { userRole: ctx.userRole, userServiceId: ctx.userServiceId, userId: ctx.userId };
}

function toLeadScope(ctx: AiToolCallerContext): LeadScope {
  return { userRole: ctx.userRole, userServiceId: ctx.userServiceId, userId: ctx.userId };
}

// dashboard.service.ts/executiveMetrics.service.ts/timeEntry.service.ts (globalSummary/
// workloadByAssignee) all take a plain `serviceId?: string` rather than a ServiceScope object —
// same convention their own REST controllers already follow (dashboard.controller.ts,
// executiveMetrics.controller.ts, timeEntry.controller.ts): ADMIN gets undefined (unscoped),
// MANAGER gets their own userServiceId (?? "__none__" so a manager with no pole yet sees nothing,
// never everything).
function toPlainServiceId(ctx: AiToolCallerContext): string | undefined {
  return ctx.userRole === "MANAGER" ? (ctx.userServiceId ?? "__none__") : undefined;
}

// aiConversation.routes.ts gates the whole router behind authenticate + authorize("ADMIN",
// "MANAGER") — ctx.userId (buildServiceScope(req).userId) is always req.user!.id, never absent,
// for any caller that reaches this code. ServiceScope declares it optional only because other
// callers of buildServiceScope (e.g. unauthenticated-adjacent paths) may not need it — this one
// always does, for project/task scoping which take userId positionally.
function requireUserId(ctx: AiToolCallerContext): string {
  if (!ctx.userId) throw new HttpError(500, "AI tool caller context is missing userId");
  return ctx.userId;
}

// Ollama's /api/chat "tools" field follows the OpenAI-style function schema.
//
// Structured filters (status/dueBefore/assigneeId/priority) exist alongside `search` because a
// full-text search forces the model to page through a truncated text-match sample and reason over
// it itself (e.g. "which tasks are overdue?" with only `search` means listing ~20 tasks and
// eyeballing dates on a 7B model) — a structured filter instead answers the question exactly, at
// the database layer, with a real total. `search` stays for genuinely free-text questions ("find
// the lead mentioning Acme").
export const AI_TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "getLeads",
      description: "Liste les leads (prospects) visibles par l'utilisateur courant, filtrés par texte de recherche et/ou par statut.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Texte à rechercher dans le nom, l'email, la source ou les notes du lead." },
          status: { type: "string", enum: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"], description: "Filtre exact sur le statut du lead." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getClients",
      description: "Liste les clients visibles par l'utilisateur courant, optionnellement filtrés par texte de recherche.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Texte à rechercher dans le nom, l'email ou le téléphone du client." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getProjects",
      description: "Liste les projets visibles par l'utilisateur courant, filtrés par texte de recherche et/ou par statut.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Texte à rechercher dans le nom ou la description du projet." },
          status: { type: "string", enum: ["PLANNING", "IN_PROGRESS", "REVIEW", "COMPLETED"], description: "Filtre exact sur le statut du projet." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getTasks",
      description: "Liste les tâches visibles par l'utilisateur courant, filtrées par texte de recherche, statut, priorité, assigné, ou tâches en retard.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Texte à rechercher dans le titre ou la description de la tâche." },
          status: { type: "string", enum: ["TODO", "IN_PROGRESS", "REVIEW", "DONE"], description: "Filtre exact sur le statut de la tâche." },
          priority: { type: "string", enum: ["LOW", "NORMAL", "HIGH", "URGENT"], description: "Filtre exact sur la priorité de la tâche." },
          overdue: { type: "boolean", description: "Si true, ne renvoie que les tâches en retard (dueDate dépassée, statut non DONE)." },
          assigneeId: { type: "string", description: "Filtre exact sur l'id du freelancer/utilisateur assigné à la tâche." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getFreelancers",
      description: "Liste les freelancers visibles par l'utilisateur courant, optionnellement filtrés par texte de recherche (nom, bio, compétence).",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Texte à rechercher dans le nom, la bio ou les compétences du freelancer." },
        },
      },
    },
  },
  // ── Aggregate tools (follow-up to SEC-059) — "where do we stand", not "list me X" ──────────
  {
    type: "function",
    function: {
      name: "getAgencyOverview",
      description: "Résumé synthétique de l'état de l'agence : nombre de leads/clients/projets/tâches par catégorie, approbations en attente, factures en retard, leads chauds. Répond à des questions comme « où en est-on ? » ou « donne-moi un résumé ».",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "getOverdueProjects",
      description: "Liste des projets en risque critique (santé dégradée, en retard, ou bloqués) — répond à « quels projets sont en retard ? » ou « quels projets sont à risque ? ». Limité aux signaux les plus importants (jusqu'à 20 au total, tous types de risques confondus) ; ne pas présenter cette liste comme forcément exhaustive.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "getOverdueInvoices",
      description: "Liste des factures actuellement en retard de paiement — répond à « quelles factures sont impayées ? » ou « quelles factures sont en retard ? ». Limité aux signaux les plus importants (jusqu'à 20 au total, tous types de risques confondus) ; ne pas présenter cette liste comme forcément exhaustive.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "getFreelancerWorkload",
      description: "Charge de travail par freelancer (heures saisies et nombre de tâches actives) sur une période — répond à « qui est le plus chargé en ce moment ? » ou « combien d'heures a fait X ce mois-ci ? ». Par défaut, les 30 derniers jours.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Date de début (ISO 8601, ex. 2026-07-01). Défaut : il y a 30 jours." },
          to: { type: "string", description: "Date de fin (ISO 8601). Défaut : aujourd'hui." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getLeadPipeline",
      description: "Nombre de leads par statut (NEW, CONTACTED, QUALIFIED, PROPOSAL, WON, LOST) — répond à « à quoi ressemble le pipeline commercial ? » ou « combien de leads sont qualifiés ? ».",
      parameters: { type: "object", properties: {} },
    },
  },
] as const;

export type AiToolName = (typeof AI_TOOL_DEFINITIONS)[number]["function"]["name"];

const TOOL_NAMES = new Set(AI_TOOL_DEFINITIONS.map((t) => t.function.name));

export function isKnownAiTool(name: string): name is AiToolName {
  return TOOL_NAMES.has(name as AiToolName);
}

// Each entity's real repository shape carries fields the assistant has no reason to see in bulk
// (full descriptions, brief JSON blobs) — summarized here to a short, stable shape rather than
// forwarded raw, keeping the payload sent back to the model small and predictable.
async function runGetLeads(ctx: AiToolCallerContext, args: { search?: string; status?: LeadStatus }) {
  const result = await leadService.getLeads(baseListOptions(args.search, args.status), toLeadScope(ctx));
  return withTruncation({
    total: result.total,
    leads: result.data.map((l) => ({
      id: l.id, name: l.name, email: l.email, status: l.status, source: l.source,
    })),
  });
}

async function runGetClients(ctx: AiToolCallerContext, args: { search?: string }) {
  const result = await clientService.getClients(baseListOptions(args.search), toServiceScope(ctx));
  return withTruncation({
    total: result.total,
    clients: result.data.map((c) => ({
      id: c.id, name: c.name, email: c.email, phone: c.phone,
    })),
  });
}

async function runGetProjects(ctx: AiToolCallerContext, args: { search?: string; status?: ProjectStatus }) {
  const result = await projectService.getAllProjects(
    requireUserId(ctx),
    ctx.userRole,
    baseListOptions(args.search),
    undefined,
    ctx.userServiceId,
    args.status ? [args.status] : undefined
  );
  return withTruncation({
    total: result.total,
    projects: result.data.map((p) => ({
      id: p.id, name: p.name, status: p.status, clientName: p.client?.name ?? null, deadline: p.deadline,
    })),
  });
}

async function runGetTasks(
  ctx: AiToolCallerContext,
  args: { search?: string; status?: TaskStatus; priority?: Priority; overdue?: boolean; assigneeId?: string }
) {
  const result = await taskService.getAllTasks(
    undefined,
    requireUserId(ctx),
    ctx.userRole,
    baseListOptions(args.search, args.status),
    toServiceScope(ctx),
    { assigneeId: args.assigneeId, overdue: args.overdue, priority: args.priority }
  );
  return withTruncation({
    total: result.total,
    tasks: result.data.map((t) => ({
      id: t.id, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate,
    })),
  });
}

async function runGetFreelancers(ctx: AiToolCallerContext, args: { search?: string }) {
  // Mirrors freelancer.controller.ts#getFreelancers exactly (scope?.userServiceId, not
  // ?? "__none__") — the other 4 tools delegate the scoping decision to their service instead of
  // re-deriving it here, and this one now does too. Note: for a MANAGER with no serviceId set,
  // this passes serviceId: undefined, which freelancerRepository.findAll treats as "no filter"
  // (sees every freelancer) — same as the REST endpoint. Whether that REST behavior is itself
  // correct is a separate question, not one this tool should silently diverge on.
  const result = await freelancerService.getAll({
    ...baseListOptions(args.search),
    serviceId: ctx.userRole === "MANAGER" ? ctx.userServiceId : undefined,
  });
  return withTruncation({
    total: result.total,
    freelancers: result.data.map((f) => ({
      id: f.id, name: f.user.name, email: f.user.email, skills: f.skills.map((s) => s.name),
    })),
  });
}

// getFullDashboard already assembles exactly this "where do we stand" view (summary + counts of
// pending approvals/overdue invoices/hot leads) for the equivalent REST endpoint
// (dashboard.controller.ts#getFullDashboard) — reused as-is rather than recomposed here, same
// serviceId convention (undefined for ADMIN, resolved pole for MANAGER).
async function runGetAgencyOverview(ctx: AiToolCallerContext) {
  return dashboardService.getFullDashboard(toPlainServiceId(ctx));
}

// executiveMetricsService.get() already computes a scoped, cached `risks: RiskItem[]` array
// (executiveMetrics.repository.ts) covering INVOICE_OVERDUE/APPROVAL_BLOCKED/PROJECT_CRITICAL/
// LEAD_HOT — filtering it here avoids re-deriving a second definition of "overdue"/"critical"
// that could silently drift from the one already shown on the executive dashboard.
//
// Not using withTruncation here: executiveMetricsRepository already caps the WHOLE risks array at
// 20 entries across all 4 types combined (risks.slice(0, 20)) before this tool ever sees it — this
// tool's own `total` (risks.length after filtering by type) can never exceed what already survived
// that upstream cap, so it cannot detect or signal a real truncation the way withTruncation does
// for getLeads/getProjects/etc. (where this tool's own query controls the page size). Flagged
// explicitly in the tool description/prompt instead of a `truncated` field that would always read
// false regardless of the real total.
async function runGetOverdueProjects(ctx: AiToolCallerContext) {
  const metrics = await executiveMetricsService.get(toPlainServiceId(ctx));
  const projects = metrics.risks.filter((r) => r.type === "PROJECT_CRITICAL");
  return { total: projects.length, projects };
}

async function runGetOverdueInvoices(ctx: AiToolCallerContext) {
  const metrics = await executiveMetricsService.get(toPlainServiceId(ctx));
  const invoices = metrics.risks.filter((r) => r.type === "INVOICE_OVERDUE");
  return { total: invoices.length, invoices };
}

const DEFAULT_WORKLOAD_WINDOW_DAYS = 30;

// A malformed/missing ISO date string from the model degrades to the default 30-day window rather
// than throwing — same doctrine as parseArgs elsewhere in this file (a bad optional field must not
// take down the whole tool call).
function parseOptionalDate(value: unknown): Date | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

async function runGetFreelancerWorkload(ctx: AiToolCallerContext, args: { from?: string; to?: string }) {
  const to = parseOptionalDate(args.to) ?? new Date();
  const from = parseOptionalDate(args.from) ?? new Date(to.getTime() - DEFAULT_WORKLOAD_WINDOW_DAYS * 86_400_000);
  // Not using withTruncation: timeEntryRepository.getWorkloadByAssignee has no page size to begin
  // with (one row per freelancer with any activity in the window, never paginated) — there is no
  // real cutoff this tool's own total could ever detect.
  const workload = await timeEntryService.workloadByAssignee(from, to, toPlainServiceId(ctx));
  return { total: workload.length, workload };
}

async function runGetLeadPipeline(ctx: AiToolCallerContext) {
  const pipeline = await leadService.getPipelineByStatus(toLeadScope(ctx));
  return { pipeline };
}

const LEAD_STATUSES: readonly LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"];
const PROJECT_STATUSES: readonly ProjectStatus[] = ["PLANNING", "IN_PROGRESS", "REVIEW", "COMPLETED"];
const TASK_STATUSES: readonly TaskStatus[] = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"];
const PRIORITIES: readonly Priority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

function pickEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

// A malformed/unparseable args object from the model (Mistral occasionally emits invalid JSON, a
// wrong type, or an out-of-enum string in tool_calls) degrades each field independently to "no
// filter" rather than throwing — every field here is optional, so there is no unsafe default to
// fall back to, and one bad field must not take down the whole call.
function parseArgs(rawArgs: unknown): {
  search?: string; status?: string; priority?: Priority; overdue?: boolean; assigneeId?: string;
  from?: string; to?: string;
} {
  if (!rawArgs || typeof rawArgs !== "object") return {};
  const obj = rawArgs as Record<string, unknown>;
  return {
    search: typeof obj.search === "string" ? obj.search : undefined,
    // status is validated per-entity by the caller (LEAD_STATUSES/PROJECT_STATUSES/TASK_STATUSES)
    // since the same field name means a different enum depending on which tool is being run.
    status: typeof obj.status === "string" ? obj.status : undefined,
    priority: pickEnum(obj.priority, PRIORITIES),
    overdue: typeof obj.overdue === "boolean" ? obj.overdue : undefined,
    assigneeId: typeof obj.assigneeId === "string" ? obj.assigneeId : undefined,
    from: typeof obj.from === "string" ? obj.from : undefined,
    to: typeof obj.to === "string" ? obj.to : undefined,
  };
}

export async function runAiTool(
  name: AiToolName,
  rawArgs: unknown,
  ctx: AiToolCallerContext
): Promise<unknown> {
  const args = parseArgs(rawArgs);
  switch (name) {
    case "getLeads":
      return runGetLeads(ctx, { search: args.search, status: pickEnum(args.status, LEAD_STATUSES) });
    case "getClients":
      return runGetClients(ctx, { search: args.search });
    case "getProjects":
      return runGetProjects(ctx, { search: args.search, status: pickEnum(args.status, PROJECT_STATUSES) });
    case "getTasks":
      return runGetTasks(ctx, {
        search: args.search,
        status: pickEnum(args.status, TASK_STATUSES),
        priority: args.priority,
        overdue: args.overdue,
        assigneeId: args.assigneeId,
      });
    case "getFreelancers":
      return runGetFreelancers(ctx, { search: args.search });
    case "getAgencyOverview":
      return runGetAgencyOverview(ctx);
    case "getOverdueProjects":
      return runGetOverdueProjects(ctx);
    case "getOverdueInvoices":
      return runGetOverdueInvoices(ctx);
    case "getFreelancerWorkload":
      return runGetFreelancerWorkload(ctx, { from: args.from, to: args.to });
    case "getLeadPipeline":
      return runGetLeadPipeline(ctx);
  }
}
