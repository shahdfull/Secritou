// Follow-up to SEC-059/SEC-068 (response-time investigation): sending all 13 tool definitions on
// every turn dominates prompt_eval time on a CPU-only Ollama host (measured ~40s with 13 tools vs
// under 1s with none). routeToolNames narrows the tool set per turn based on the user's message —
// this test calls the real function, not a reimplementation, and asserts its core safety property:
// an unmatched message always falls back to every tool, never a narrower guess.
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { routeToolNames } from "../src/services/aiToolRouter.js";

const ALL_TOOL_NAMES = [
  "getLeads", "getClients", "getProjects", "getTasks", "getFreelancers",
  "getAgencyOverview", "getOverdueProjects", "getOverdueInvoices",
  "getFreelancerWorkload", "getLeadPipeline", "searchSemantic",
  "proposeCreateTask", "proposeUpdateLeadStatus", "proposeUpdateTaskStatus",
];

describe("routeToolNames (SEC-068 follow-up)", () => {
  test("a message with no recognized keyword falls back to null (caller sends every tool)", () => {
    assert.equal(routeToolNames("Bonjour"), null);
    assert.equal(routeToolNames(""), null);
    assert.equal(routeToolNames("asdkjaslkdj random gibberish"), null);
  });

  test("a lead-related question routes to the lead tools only", () => {
    const routed = routeToolNames("Quels sont mes leads en cours ?");
    assert.ok(routed);
    assert.ok(routed.has("getLeads"));
    assert.ok(routed.has("getLeadPipeline"));
    assert.equal(routed.has("getTasks"), false);
    assert.equal(routed.has("getClients"), false);
  });

  test("an overview question routes to getAgencyOverview only", () => {
    const routed = routeToolNames("Où en est l'agence ?");
    assert.ok(routed);
    assert.ok(routed.has("getAgencyOverview"));
    assert.equal(routed.size, 1);
  });

  test("a task-creation request routes to task tools plus all propose* action tools", () => {
    const routed = routeToolNames("Crée une tâche pour rédiger le brief");
    assert.ok(routed);
    assert.ok(routed.has("getTasks"));
    assert.ok(routed.has("proposeCreateTask"));
    assert.ok(routed.has("proposeUpdateLeadStatus"));
    assert.ok(routed.has("proposeUpdateTaskStatus"));
  });

  test("accents are normalized — 'tache' and 'tâche' route identically", () => {
    const withAccent = routeToolNames("mes tâches en retard");
    const withoutAccent = routeToolNames("mes taches en retard");
    assert.ok(withAccent);
    assert.ok(withoutAccent);
    assert.deepEqual([...withAccent].sort(), [...withoutAccent].sort());
  });

  test("a message combining two categories routes tools from both, not just one", () => {
    const routed = routeToolNames("mes leads et mes projets en retard");
    assert.ok(routed);
    assert.ok(routed.has("getLeads"));
    assert.ok(routed.has("getProjects"));
    assert.ok(routed.has("getOverdueProjects"));
  });

  test("an invoice question routes to getOverdueInvoices without needing 'retard'/'impayé' wording", () => {
    const routed = routeToolNames("Montre-moi les factures");
    assert.ok(routed);
    assert.ok(routed.has("getOverdueInvoices"));
    assert.equal(routed.has("getOverdueProjects"), false);
  });

  test("a lead-outcome word alone (e.g. 'gagné') routes to lead status tools", () => {
    const routed = routeToolNames("Ce lead est gagné");
    assert.ok(routed);
    assert.ok(routed.has("proposeUpdateLeadStatus"));
    assert.ok(routed.has("getLeads"));
  });

  test("every routed tool name is a real tool name (no typo in the router's own tables)", () => {
    const messages = [
      "leads", "clients", "projets", "taches", "freelancers", "agence",
      "retard", "charge", "cree une tache", "factures", "gagne", "perdu", "qualifie",
    ];
    for (const message of messages) {
      const routed = routeToolNames(message);
      if (!routed) continue;
      for (const name of routed) {
        assert.ok(ALL_TOOL_NAMES.includes(name), `"${name}" (routed from "${message}") is not a real tool name`);
      }
    }
  });
});
