// SEC-059 follow-up: parseAssistantMessage must match the exact marker format
// aiConversation.service.ts#encodeActionProposal writes server-side — this test calls the real
// parseAssistantMessage (not a reimplementation), covering the plain-text path (no marker), a
// valid proposal, and malformed/truncated input that must degrade to "no proposal" rather than
// throwing (a message persisted by a different server version, or a manual DB edit, is not
// impossible).

import { describe, expect, test } from "vitest";
import { parseAssistantMessage } from "./actionProposal";

const MARKER_START = "\n\n<!--secritou:ai-action-proposal:";
const MARKER_END = "-->";

function encode(text: string, proposal: unknown): string {
  return `${text}${MARKER_START}${JSON.stringify(proposal)}${MARKER_END}`;
}

describe("parseAssistantMessage (SEC-059 follow-up)", () => {
  test("a plain message with no marker returns the text unchanged and no proposal", () => {
    const result = parseAssistantMessage("Bonjour, comment puis-je vous aider ?");
    expect(result.visibleText).toBe("Bonjour, comment puis-je vous aider ?");
    expect(result.proposal).toBeNull();
  });

  test("a valid createTask proposal is extracted, and the visible text excludes the marker", () => {
    const proposal = { type: "createTask", valid: true, projectId: "p1", projectName: "Refonte site", title: "Rédiger le brief" };
    const content = encode("J'ai préparé la proposition ci-dessous.", proposal);

    const result = parseAssistantMessage(content);
    expect(result.visibleText).toBe("J'ai préparé la proposition ci-dessous.");
    expect(result.proposal).toEqual(proposal);
  });

  test("a valid updateLeadStatus proposal round-trips exactly", () => {
    const proposal = {
      type: "updateLeadStatus", valid: true, leadId: "l1", leadName: "Acme Corp", fromStatus: "NEW", toStatus: "QUALIFIED",
    };
    const content = encode("Voici la transition proposée.", proposal);

    const result = parseAssistantMessage(content);
    expect(result.proposal).toEqual(proposal);
  });

  test("an invalid (valid: false) proposal is still extracted, with its reason", () => {
    const proposal = { type: "updateTaskStatus", valid: false, reason: "Cette tâche est déjà au statut DONE." };
    const content = encode("Je ne peux pas proposer cette action.", proposal);

    const result = parseAssistantMessage(content);
    expect(result.proposal).toEqual(proposal);
  });

  test("a marker with malformed JSON degrades to no proposal, keeping the visible text before the marker", () => {
    const content = `Réponse normale.${MARKER_START}{not valid json${MARKER_END}`;
    const result = parseAssistantMessage(content);
    expect(result.visibleText).toBe("Réponse normale.");
    expect(result.proposal).toBeNull();
  });

  test("a marker start with no matching end marker degrades to no proposal, returning the FULL original text", () => {
    const content = `Réponse tronquée.${MARKER_START}{"type":"createTask"`;
    const result = parseAssistantMessage(content);
    expect(result.visibleText).toBe(content);
    expect(result.proposal).toBeNull();
  });

  test("a message that merely mentions the marker string inside normal prose (no real proposal follows) does not crash", () => {
    // Defensive case: if the model ever echoes something resembling the marker in its own visible
    // text (never expected in practice, since it's never part of any tool result shown to the
    // model), parsing must degrade gracefully rather than throw.
    const content = `Le format ressemble à ${MARKER_START.trim()} quelque chose.`;
    const result = parseAssistantMessage(content);
    expect(result.proposal).toBeNull();
  });
});
