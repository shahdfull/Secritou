// Sending all 13 tool definitions on every turn measurably dominates response time on a CPU-only
// Ollama host: prompt_eval (the model reading the tools JSON + system prompt) takes ~20-45s with
// 5-13 tools present, vs under 1s with none — the actual answer generation itself only takes
// ~1s regardless. This router picks a smaller, category-based subset of tools from the user's
// latest message before the first Ollama call of a turn, cutting prompt_eval roughly in
// proportion to how many tools are dropped.
//
// Safety doctrine: when in doubt, include more tools rather than fewer. A keyword miss that sends
// too many tools only costs latency (back to the current behavior); a miss that sends too few
// silently removes a capability the user asked for, which is a much worse failure mode. The
// no-keyword-matched fallback is therefore always the FULL set, never an empty or arbitrary one.
import type { AiToolName } from "./aiTools.js";
import type { AiActionToolName } from "./aiActionProposals.js";

type ToolName = AiToolName | AiActionToolName;

const CATEGORY_KEYWORDS: Record<string, readonly string[]> = {
  leads: ["lead", "leads", "prospect", "prospects", "pipeline"],
  clients: ["client", "clients"],
  projects: ["projet", "projets", "project", "projects"],
  tasks: ["tache", "taches", "tâche", "tâches", "task", "tasks"],
  freelancers: ["freelance", "freelancer", "freelancers", "freelances"],
  overview: [
    "agence", "resume", "résumé", "bilan", "ensemble", "vue d'ensemble",
    "où en est", "ou en est", "où en sommes", "ou en sommes",
  ],
  overdue: ["retard", "retards", "en retard", "impaye", "impayé", "impayés", "impayees", "impayées"],
  workload: ["charge", "chargé", "charge de travail", "disponibilite", "disponibilité"],
  // getOverdueInvoices was previously reachable only via "overdue" keywords (retard/impayé) — a
  // plain "facture"/"factures"/"invoice" mention with neither word matched no category at all,
  // correctly falling back to the full set (safe) but never narrowing for the most common phrasing
  // of this exact question ("montre-moi les factures").
  invoices: ["facture", "factures", "invoice", "invoices"],
  // proposeUpdateLeadStatus's own status enum (NEW/CONTACTED/QUALIFIED/PROPOSAL/WON/LOST) has
  // French equivalents a user would plausibly say ("passe ce lead en gagné") that the generic
  // "write" verbs (cree/change/marque...) already catch structurally, but not the status words
  // themselves in isolation (e.g. "marque-le comme gagné" matches "marque" already — this adds the
  // outcome words alone, e.g. "ce lead est gagné", which "write" verbs alone would miss).
  leadStatus: [
    "gagne", "gagné", "perdu", "perdue", "qualifie", "qualifié", "qualifiee", "qualifiée",
    "nouveau lead", "prospect qualifie", "prospect qualifié",
  ],
  write: [
    "cree", "crée", "creer", "créer", "ajoute", "ajouter", "change", "changer",
    "passe", "passer", "avance", "avancer", "fait avancer", "deplace", "déplace",
    "marque", "marquer",
  ],
};

// SEC-070: searchSemantic spans all 3 entity types (Lead.notes/Project.description/
// Task.description) in a single query — no category maps to it alone, so it rides along on
// leads/projects/tasks (the entity categories it actually searches across) rather than needing
// its own keyword list. Same "include more rather than fewer" doctrine as the module comment.
const CATEGORY_TOOLS: Record<string, readonly ToolName[]> = {
  leads: ["getLeads", "getLeadPipeline", "searchSemantic"],
  clients: ["getClients"],
  projects: ["getProjects", "getOverdueProjects", "searchSemantic"],
  tasks: ["getTasks", "searchSemantic"],
  freelancers: ["getFreelancers", "getFreelancerWorkload"],
  overview: ["getAgencyOverview"],
  overdue: ["getOverdueProjects", "getOverdueInvoices"],
  workload: ["getFreelancerWorkload"],
  invoices: ["getOverdueInvoices"],
  leadStatus: ["getLeads", "proposeUpdateLeadStatus"],
  write: ["proposeCreateTask", "proposeUpdateLeadStatus", "proposeUpdateTaskStatus"],
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // strip accents so "tâche"/"tache" both match "tache"
}

// Returns the set of tool names relevant to `message`, or null if no category keyword matched
// (caller falls back to the full tool set — see module doc comment).
export function routeToolNames(message: string): Set<ToolName> | null {
  const normalized = normalize(message);
  const matched = new Set<ToolName>();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const hasKeyword = keywords.some((kw) => normalized.includes(normalize(kw)));
    if (hasKeyword) {
      for (const tool of CATEGORY_TOOLS[category]!) matched.add(tool);
    }
  }

  return matched.size > 0 ? matched : null;
}
