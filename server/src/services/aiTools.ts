// SEC-059: gives the AI assistant real read access to CRM data (Lead/Client/Project/Task/
// Freelancer) via Ollama tool calling. Every scoping decision is delegated to the same
// service/repository the equivalent REST endpoint already uses (leadService, clientService,
// projectService, taskService, freelancerService) — never a parallel query path, and never a
// second scoping rule reimplemented here (a tool that re-derives its own filter instead of
// forwarding the caller's raw scope can silently diverge from the REST behavior it claims to
// mirror). Read-only: no create/update/delete tool is exposed here.
import { leadService } from "./lead.service.js";
import { clientService } from "./client.service.js";
import { projectService } from "./project.service.js";
import { taskService } from "./task.service.js";
import { freelancerService } from "./freelancer.service.js";
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

function baseListOptions(search?: string): ListQueryOptions {
  return { page: 1, pageSize: TOOL_LIST_PAGE_SIZE, orderDir: "desc", search };
}

function toServiceScope(ctx: AiToolCallerContext): ServiceScope {
  return { userRole: ctx.userRole, userServiceId: ctx.userServiceId, userId: ctx.userId };
}

function toLeadScope(ctx: AiToolCallerContext): LeadScope {
  return { userRole: ctx.userRole, userServiceId: ctx.userServiceId, userId: ctx.userId };
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
export const AI_TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "getLeads",
      description: "Liste les leads (prospects) visibles par l'utilisateur courant, optionnellement filtrés par texte de recherche.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Texte à rechercher dans le nom, l'email, la source ou les notes du lead." },
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
      description: "Liste les projets visibles par l'utilisateur courant, optionnellement filtrés par texte de recherche.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Texte à rechercher dans le nom ou la description du projet." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getTasks",
      description: "Liste les tâches visibles par l'utilisateur courant, optionnellement filtrées par texte de recherche.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Texte à rechercher dans le titre ou la description de la tâche." },
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
] as const;

export type AiToolName = (typeof AI_TOOL_DEFINITIONS)[number]["function"]["name"];

const TOOL_NAMES = new Set(AI_TOOL_DEFINITIONS.map((t) => t.function.name));

export function isKnownAiTool(name: string): name is AiToolName {
  return TOOL_NAMES.has(name as AiToolName);
}

// Each entity's real repository shape carries fields the assistant has no reason to see in bulk
// (full descriptions, brief JSON blobs) — summarized here to a short, stable shape rather than
// forwarded raw, keeping the payload sent back to the model small and predictable.
async function runGetLeads(ctx: AiToolCallerContext, args: { search?: string }) {
  const result = await leadService.getLeads(baseListOptions(args.search), toLeadScope(ctx));
  return {
    total: result.total,
    leads: result.data.map((l) => ({
      id: l.id, name: l.name, email: l.email, status: l.status, source: l.source,
    })),
  };
}

async function runGetClients(ctx: AiToolCallerContext, args: { search?: string }) {
  const result = await clientService.getClients(baseListOptions(args.search), toServiceScope(ctx));
  return {
    total: result.total,
    clients: result.data.map((c) => ({
      id: c.id, name: c.name, email: c.email, phone: c.phone,
    })),
  };
}

async function runGetProjects(ctx: AiToolCallerContext, args: { search?: string }) {
  const result = await projectService.getAllProjects(
    requireUserId(ctx),
    ctx.userRole,
    baseListOptions(args.search),
    undefined,
    ctx.userServiceId
  );
  return {
    total: result.total,
    projects: result.data.map((p) => ({
      id: p.id, name: p.name, status: p.status, clientName: p.client?.name ?? null, deadline: p.deadline,
    })),
  };
}

async function runGetTasks(ctx: AiToolCallerContext, args: { search?: string }) {
  const result = await taskService.getAllTasks(
    undefined,
    requireUserId(ctx),
    ctx.userRole,
    baseListOptions(args.search),
    toServiceScope(ctx)
  );
  return {
    total: result.total,
    tasks: result.data.map((t) => ({
      id: t.id, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate,
    })),
  };
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
  return {
    total: result.total,
    freelancers: result.data.map((f) => ({
      id: f.id, name: f.user.name, email: f.user.email, skills: f.skills.map((s) => s.name),
    })),
  };
}

// A malformed/unparseable args object from the model (Mistral occasionally emits invalid JSON in
// tool_calls) degrades to "no filter" rather than throwing — the search argument is the only
// input surface here and is optional everywhere, so there is no unsafe default to fall back to.
function parseArgs(rawArgs: unknown): { search?: string } {
  if (rawArgs && typeof rawArgs === "object" && "search" in rawArgs) {
    const search = (rawArgs as { search?: unknown }).search;
    if (typeof search === "string") return { search };
  }
  return {};
}

export async function runAiTool(
  name: AiToolName,
  rawArgs: unknown,
  ctx: AiToolCallerContext
): Promise<unknown> {
  const args = parseArgs(rawArgs);
  switch (name) {
    case "getLeads":
      return runGetLeads(ctx, args);
    case "getClients":
      return runGetClients(ctx, args);
    case "getProjects":
      return runGetProjects(ctx, args);
    case "getTasks":
      return runGetTasks(ctx, args);
    case "getFreelancers":
      return runGetFreelancers(ctx, args);
  }
}
