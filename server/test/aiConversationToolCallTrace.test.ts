// SEC-059 follow-up: aiConversationService.addMessage must persist one AiToolCall row per tool the
// model actually called this turn — this test calls the real aiConversationService.addMessage
// (via runConversationTurn) against a real database, mocking only globalThis.fetch to simulate
// Ollama requesting a tool then answering, and asserts the AiToolCall trace left behind.

import test, { describe, before, after, mock } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let aiConversationService: typeof import("../src/services/aiConversation.service.js").aiConversationService;
let dbAvailable = true;
let originalFetch: typeof fetch;

const createdUserIds: string[] = [];
const createdConversationIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
  }
  ({ aiConversationService } = await import("../src/services/aiConversation.service.js"));
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.aiToolCall.deleteMany({ where: { conversationId: { in: createdConversationIds } } });
  await prisma.aiMessage.deleteMany({ where: { conversationId: { in: createdConversationIds } } });
  await prisma.aiConversation.deleteMany({ where: { id: { in: createdConversationIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

// Simulates Ollama's two-round-trip tool-calling exchange: first response asks for getProjects,
// second responds with real content — same shape callOllamaWithTools/postChat expect (JSON, not
// NDJSON, since addMessage — the non-streaming path — is what's under test here).
function mockOllamaToolThenAnswer() {
  let callCount = 0;
  mock.method(globalThis, "fetch", async () => {
    callCount += 1;
    if (callCount === 1) {
      return new Response(
        JSON.stringify({
          message: {
            role: "assistant",
            content: "",
            tool_calls: [{ function: { name: "getProjects", arguments: {} } }],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ message: { role: "assistant", content: "Voici vos projets." } }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  });
}

describe("aiConversationService persists an AiToolCall trace per tool call (SEC-059 follow-up)", () => {
  test("addMessage records one AiToolCall row with outcome=success for a real getProjects call", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }

    const uniq = Date.now();
    const user = await prisma.user.create({
      data: { name: `AiToolCall user ${uniq}`, email: `aitoolcall-${uniq}@example.com`, passwordHash: "x", role: "ADMIN" },
    });
    createdUserIds.push(user.id);
    const conv = await prisma.aiConversation.create({ data: { userId: user.id, title: "test" } });
    createdConversationIds.push(conv.id);

    originalFetch = globalThis.fetch;
    mockOllamaToolThenAnswer();

    try {
      await aiConversationService.addMessage(conv.id, user.id, "quels sont mes projets ?", {
        userRole: "ADMIN",
        userId: user.id,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    const toolCalls = await prisma.aiToolCall.findMany({ where: { conversationId: conv.id } });
    assert.equal(toolCalls.length, 1);
    assert.equal(toolCalls[0]?.tool, "getProjects");
    assert.equal(toolCalls[0]?.outcome, "success");
    assert.equal(typeof toolCalls[0]?.rowCount, "number");
    assert.ok(toolCalls[0]!.durationMs >= 0);

    // Tool exchanges are never persisted as AiMessage (doctrine: AiMessage is chat history, not an
    // execution log) — only the USER question and the final ASSISTANT answer.
    const messages = await prisma.aiMessage.findMany({ where: { conversationId: conv.id } });
    assert.equal(messages.length, 2);
  });

  test("addMessage records outcome=unknown_tool for a hallucinated tool name, without crashing the turn", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }

    const uniq = Date.now();
    const user = await prisma.user.create({
      data: { name: `AiToolCall unknown user ${uniq}`, email: `aitoolcall-unknown-${uniq}@example.com`, passwordHash: "x", role: "ADMIN" },
    });
    createdUserIds.push(user.id);
    const conv = await prisma.aiConversation.create({ data: { userId: user.id, title: "test" } });
    createdConversationIds.push(conv.id);

    originalFetch = globalThis.fetch;
    let callCount = 0;
    mock.method(globalThis, "fetch", async () => {
      callCount += 1;
      if (callCount === 1) {
        return new Response(
          JSON.stringify({
            message: { role: "assistant", content: "", tool_calls: [{ function: { name: "deleteEverything", arguments: {} } }] },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ message: { role: "assistant", content: "Je ne peux pas faire ça." } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    try {
      await aiConversationService.addMessage(conv.id, user.id, "supprime tout", { userRole: "ADMIN", userId: user.id });
    } finally {
      globalThis.fetch = originalFetch;
    }

    const toolCalls = await prisma.aiToolCall.findMany({ where: { conversationId: conv.id } });
    assert.equal(toolCalls.length, 1);
    assert.equal(toolCalls[0]?.tool, "deleteEverything");
    assert.equal(toolCalls[0]?.outcome, "unknown_tool");
  });
});
