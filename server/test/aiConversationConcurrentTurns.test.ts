// SEC-090: addMessageStreaming/addMessage had no lock on a conversation — two calls on the same
// id, started a few hundred ms apart, each read recentMessages before the other had persisted its
// own ASSISTANT reply, so neither turn's Ollama call ever saw the other's message. Fixed by a
// conversationsInFlight Set shared between both methods: a second call on an id already in flight
// now rejects immediately with 409 CONVERSATION_TURN_IN_PROGRESS.
//
// This test calls the real aiConversationService.addMessageStreaming (not a reimplementation)
// against a real database, mocking only globalThis.fetch with a deliberately slow stream so the
// first call is still in flight when the second one starts — same technique as
// aiConversationToolCallTrace.test.ts (mock fetch, call the real service).

import test, { describe, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../src/utils/httpError.js";

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

// A stream that yields its first chunk immediately, then waits before yielding the rest — long
// enough that a second call started right after the first is guaranteed to still find it in
// flight, without depending on a real Ollama's actual generation time.
function slowNdjsonStream(delayMs: number): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(JSON.stringify({ message: { role: "assistant", content: "OK" }, done: false }) + "\n"));
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      controller.enqueue(encoder.encode(JSON.stringify({ message: { role: "assistant", content: "." }, done: true }) + "\n"));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "application/x-ndjson" } });
}

describe("addMessageStreaming rejects a concurrent turn on the same conversation (SEC-090)", () => {
  test("a second call on the same conversation, started while the first is still in flight, rejects with 409", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }

    const uniq = Date.now();
    const user = await prisma.user.create({
      data: { name: `SEC090 user ${uniq}`, email: `sec090-${uniq}@example.com`, passwordHash: "x", role: "ADMIN" },
    });
    createdUserIds.push(user.id);
    const conv = await prisma.aiConversation.create({ data: { userId: user.id, title: "test" } });
    createdConversationIds.push(conv.id);

    originalFetch = globalThis.fetch;
    mock.method(globalThis, "fetch", async () => slowNdjsonStream(500));

    try {
      const callerContext = { userRole: "ADMIN" as const, userId: user.id };
      const firstTurn = aiConversationService.addMessageStreaming(
        conv.id,
        user.id,
        "premier message",
        callerContext,
        () => {}
      );

      // Started well before the first turn's 500ms artificial delay resolves — guaranteed overlap.
      await new Promise((resolve) => setTimeout(resolve, 50));

      await assert.rejects(
        () => aiConversationService.addMessageStreaming(conv.id, user.id, "second message", callerContext, () => {}),
        (err: unknown) => {
          assert.ok(err instanceof HttpError);
          assert.equal(err.statusCode, 409);
          assert.equal(err.code, "CONVERSATION_TURN_IN_PROGRESS");
          return true;
        }
      );

      // The first turn must still complete normally — rejecting the second must not have
      // corrupted or aborted the one already in flight.
      await firstTurn;

      const messages = await prisma.aiMessage.findMany({ where: { conversationId: conv.id }, orderBy: { createdAt: "asc" } });
      assert.equal(messages.length, 2, "only the first turn's USER+ASSISTANT pair must be persisted");
      assert.equal(messages[0]!.role, "USER");
      assert.equal(messages[0]!.content, "premier message");
      assert.equal(messages[1]!.role, "ASSISTANT");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
