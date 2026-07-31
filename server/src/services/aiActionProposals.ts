// SEC-059 follow-up: write action proposals for the AI assistant. Non-negotiable design rule
// (explicit product decision, not inferred): the model NEVER writes directly. Each tool here only
// validates that an action is plausible (target exists, is in scope for this caller, obvious
// transition rules aren't already violated) using the exact same read paths a real write would use
// first — it returns a structured proposal, never performs the Prisma write itself. The client
// renders a confirmation card from that proposal; only a user click calls the real REST endpoint
// (POST /tasks, PUT /tasks/:id, PUT /leads/:id), which reruns its own full validation/scoping from
// scratch. A tool here saying "this looks valid" is never authoritative — the REST endpoint is.
import type { LeadStatus, TaskStatus } from "@prisma/client";
import { ALLOWED_TASK_TRANSITIONS } from "@secritou/shared";
import { leadService } from "./lead.service.js";
import { taskService } from "./task.service.js";
import { projectService } from "./project.service.js";
import type { AiToolCallerContext } from "./aiTools.js";
import { HttpError } from "../utils/httpError.js";

function requireUserId(ctx: AiToolCallerContext): string {
  if (!ctx.userId) throw new HttpError(500, "AI tool caller context is missing userId");
  return ctx.userId;
}

// Duplicated from lead.service.ts (not exported there) — informative only, to reject an obviously
// invalid proposal before it ever reaches the user as a confirmation card. The real gate is
// lead.service.ts#updateLead's own check at confirmation time; if this table ever drifts from that
// one, the worst case is a proposal that looks valid here and gets rejected by the REST endpoint
// with LEAD_INVALID_TRANSITION when confirmed — never a bypass of the real rule.
const LEAD_NEXT_STATUSES: Record<LeadStatus, LeadStatus[]> = {
  NEW: ["CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"],
  CONTACTED: ["QUALIFIED", "PROPOSAL", "WON", "LOST"],
  QUALIFIED: ["PROPOSAL", "WON", "LOST"],
  PROPOSAL: ["WON", "LOST"],
  WON: [],
  LOST: [],
};

export const AI_ACTION_TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "proposeCreateTask",
      description: "Propose la création d'une nouvelle tâche sur un projet existant — ne crée RIEN directement, l'utilisateur doit confirmer dans l'interface. Utilise ce tool quand l'utilisateur demande de créer une tâche.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Id du projet sur lequel créer la tâche (obtenu via getProjects si besoin)." },
          title: { type: "string", description: "Titre de la tâche (obligatoire)." },
          description: { type: "string", description: "Description optionnelle de la tâche." },
          assigneeId: { type: "string", description: "Id du freelancer/utilisateur à assigner (optionnel, obtenu via getFreelancers si besoin)." },
        },
        required: ["projectId", "title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "proposeUpdateLeadStatus",
      description: "Propose de changer le statut d'un lead existant — ne modifie RIEN directement, l'utilisateur doit confirmer dans l'interface. Utilise ce tool quand l'utilisateur demande de faire avancer un lead dans le pipeline.",
      parameters: {
        type: "object",
        properties: {
          leadId: { type: "string", description: "Id du lead (obtenu via getLeads si besoin)." },
          status: { type: "string", enum: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"], description: "Nouveau statut proposé." },
        },
        required: ["leadId", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "proposeUpdateTaskStatus",
      description: "Propose de changer le statut d'une tâche existante — ne modifie RIEN directement, l'utilisateur doit confirmer dans l'interface. Utilise ce tool quand l'utilisateur demande de faire avancer une tâche.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string", description: "Id de la tâche (obtenu via getTasks si besoin)." },
          status: { type: "string", enum: ["TODO", "IN_PROGRESS", "REVIEW", "DONE"], description: "Nouveau statut proposé." },
        },
        required: ["taskId", "status"],
      },
    },
  },
] as const;

export type AiActionToolName = (typeof AI_ACTION_TOOL_DEFINITIONS)[number]["function"]["name"];

const ACTION_TOOL_NAMES = new Set(AI_ACTION_TOOL_DEFINITIONS.map((t) => t.function.name));

export function isKnownAiActionTool(name: string): name is AiActionToolName {
  return ACTION_TOOL_NAMES.has(name as AiActionToolName);
}

// Discriminated union persisted (as JSON, appended to the ASSISTANT message content — see
// aiConversation.service.ts) so the confirmation card survives a page reload, same as the rest of
// the chat history. `valid: false` still returns a proposal (not an error) so the model can explain
// why to the user instead of the whole tool call failing — the card renders disabled/explained
// rather than actionable in that case.
export type AiActionProposal =
  | {
      type: "createTask";
      valid: true;
      projectId: string;
      projectName: string;
      title: string;
      description?: string;
      assigneeId?: string;
    }
  | { type: "createTask"; valid: false; reason: string }
  | {
      type: "updateLeadStatus";
      valid: true;
      leadId: string;
      leadName: string;
      fromStatus: LeadStatus;
      toStatus: LeadStatus;
    }
  | { type: "updateLeadStatus"; valid: false; reason: string }
  | {
      type: "updateTaskStatus";
      valid: true;
      taskId: string;
      taskTitle: string;
      fromStatus: TaskStatus;
      toStatus: TaskStatus;
    }
  | { type: "updateTaskStatus"; valid: false; reason: string };

function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && value in ALLOWED_TASK_TRANSITIONS;
}

function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && value in LEAD_NEXT_STATUSES;
}

async function proposeCreateTask(
  ctx: AiToolCallerContext,
  args: { projectId?: unknown; title?: unknown; description?: unknown; assigneeId?: unknown }
): Promise<AiActionProposal> {
  const projectId = typeof args.projectId === "string" ? args.projectId : undefined;
  const title = typeof args.title === "string" ? args.title.trim() : undefined;
  if (!projectId || !title) {
    return { type: "createTask", valid: false, reason: "Il manque le projet ou le titre de la tâche." };
  }

  // Same read path createTask itself would hit first (getProjectById 404s/403s exactly like the
  // real create would) — proves the project exists and is in this caller's scope before a
  // confirmation card is ever shown, without performing any write.
  let project: { name: string };
  try {
    project = await projectService.getProjectById(projectId, requireUserId(ctx), ctx.userRole, undefined, ctx.userServiceId);
  } catch {
    return { type: "createTask", valid: false, reason: "Ce projet n'existe pas ou n'est pas accessible." };
  }

  return {
    type: "createTask",
    valid: true,
    projectId,
    projectName: project.name,
    title,
    description: typeof args.description === "string" ? args.description : undefined,
    assigneeId: typeof args.assigneeId === "string" ? args.assigneeId : undefined,
  };
}

async function proposeUpdateLeadStatus(
  ctx: AiToolCallerContext,
  args: { leadId?: unknown; status?: unknown }
): Promise<AiActionProposal> {
  const leadId = typeof args.leadId === "string" ? args.leadId : undefined;
  if (!leadId || !isLeadStatus(args.status)) {
    return { type: "updateLeadStatus", valid: false, reason: "Il manque le lead ou le statut cible n'est pas valide." };
  }

  let lead: { name: string; status: LeadStatus };
  try {
    lead = await leadService.getLead(leadId, { userRole: ctx.userRole, userServiceId: ctx.userServiceId, userId: ctx.userId });
  } catch {
    return { type: "updateLeadStatus", valid: false, reason: "Ce lead n'existe pas ou n'est pas accessible." };
  }

  if (lead.status === args.status) {
    return { type: "updateLeadStatus", valid: false, reason: `Ce lead est déjà au statut ${args.status}.` };
  }
  if (!LEAD_NEXT_STATUSES[lead.status].includes(args.status)) {
    return {
      type: "updateLeadStatus",
      valid: false,
      reason: `Transition non autorisée : un lead ${lead.status} ne peut pas passer directement à ${args.status}.`,
    };
  }

  return { type: "updateLeadStatus", valid: true, leadId, leadName: lead.name, fromStatus: lead.status, toStatus: args.status };
}

async function proposeUpdateTaskStatus(
  ctx: AiToolCallerContext,
  args: { taskId?: unknown; status?: unknown }
): Promise<AiActionProposal> {
  const taskId = typeof args.taskId === "string" ? args.taskId : undefined;
  if (!taskId || !isTaskStatus(args.status)) {
    return { type: "updateTaskStatus", valid: false, reason: "Il manque la tâche ou le statut cible n'est pas valide." };
  }

  let task: { title: string; status: TaskStatus };
  try {
    task = await taskService.getTaskById(taskId, requireUserId(ctx), ctx.userRole, {
      userRole: ctx.userRole,
      userServiceId: ctx.userServiceId,
      userId: ctx.userId,
    });
  } catch {
    return { type: "updateTaskStatus", valid: false, reason: "Cette tâche n'existe pas ou n'est pas accessible." };
  }

  if (task.status === args.status) {
    return { type: "updateTaskStatus", valid: false, reason: `Cette tâche est déjà au statut ${args.status}.` };
  }
  if (!ALLOWED_TASK_TRANSITIONS[task.status].includes(args.status)) {
    return {
      type: "updateTaskStatus",
      valid: false,
      reason: `Transition non autorisée : une tâche ${task.status} ne peut pas passer directement à ${args.status}.`,
    };
  }

  return { type: "updateTaskStatus", valid: true, taskId, taskTitle: task.title, fromStatus: task.status, toStatus: args.status };
}

export async function runAiActionTool(
  name: AiActionToolName,
  rawArgs: unknown,
  ctx: AiToolCallerContext
): Promise<AiActionProposal> {
  const args = (rawArgs && typeof rawArgs === "object" ? rawArgs : {}) as Record<string, unknown>;
  switch (name) {
    case "proposeCreateTask":
      return proposeCreateTask(ctx, args);
    case "proposeUpdateLeadStatus":
      return proposeUpdateLeadStatus(ctx, args);
    case "proposeUpdateTaskStatus":
      return proposeUpdateTaskStatus(ctx, args);
  }
}
