// SEC-059 follow-up: parses the machine-readable action proposal the server appends to an
// ASSISTANT message's content (aiConversation.service.ts#encodeActionProposal) — must match that
// marker exactly, it is the single source of truth for the wire format between server and client.
import type { TaskStatus } from "@secritou/shared";
import type { Lead } from "@/types/lead";

type LeadStatus = Lead["status"];

const MARKER_START = "\n\n<!--secritou:ai-action-proposal:";
const MARKER_END = "-->";

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

export interface ParsedAssistantMessage {
  visibleText: string;
  proposal: AiActionProposal | null;
}

// A message with no marker (the overwhelming majority — plain answers, tool-call replies with no
// action proposed) returns unmodified text and a null proposal; a malformed/truncated marker
// (should never happen from a well-behaved server, but a message persisted by a different code
// version or a manual DB edit is not impossible) degrades to "no proposal" rather than throwing —
// the chat must never fail to render because of one unparseable message.
export function parseAssistantMessage(content: string): ParsedAssistantMessage {
  const startIndex = content.indexOf(MARKER_START);
  if (startIndex === -1) return { visibleText: content, proposal: null };

  const jsonStart = startIndex + MARKER_START.length;
  const endIndex = content.indexOf(MARKER_END, jsonStart);
  if (endIndex === -1) return { visibleText: content, proposal: null };

  const visibleText = content.slice(0, startIndex);
  try {
    const proposal = JSON.parse(content.slice(jsonStart, endIndex)) as AiActionProposal;
    return { visibleText, proposal };
  } catch {
    return { visibleText, proposal: null };
  }
}
