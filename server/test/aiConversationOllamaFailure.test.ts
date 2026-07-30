// SEC-035: aiConversationService.create/addMessage used to persist the USER message BEFORE
// calling Ollama — a failed/timed-out call left an orphaned USER message with no reply, and a
// naive client retry duplicated it on every failed attempt. Fixed by calling callOllama first;
// nothing is persisted unless the call succeeds.
//
// This test calls the real aiConversationService.create/addMessage (not a reimplementation)
// against the real callOllama, relying on Ollama being unreachable in this environment (default
// OLLAMA_URL http://localhost:11434, no local Ollama server running here) to trigger the actual
// failure path — skipped if Ollama happens to be reachable, or if the DB is unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let aiConversationService: typeof import("../src/services/aiConversation.service.js").aiConversationService;
let dbAvailable = true;
let ollamaReachable = true;

const createdUserIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
  }

  try {
    const { env } = await import("../src/config/env.js");
    const res = await fetch(`${env.OLLAMA_URL}/api/chat`, { signal: AbortSignal.timeout(2000) });
    ollamaReachable = res.ok || res.status < 500;
  } catch {
    ollamaReachable = false;
  }

  ({ aiConversationService } = await import("../src/services/aiConversation.service.js"));
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe("aiConversationService leaves no trace on Ollama failure (SEC-035)", () => {
  test("create() persists nothing if callOllama fails", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    if (ollamaReachable) { t.skip("Ollama is reachable in this environment, cannot exercise the failure path"); return; }

    const uniq = Date.now();
    const user = await prisma.user.create({
      data: { name: `SEC035 user ${uniq}`, email: `sec035-${uniq}@example.com`, passwordHash: "x", role: "ADMIN" },
    });
    createdUserIds.push(user.id);

    await assert.rejects(() => aiConversationService.create(user.id, "Bonjour, aide-moi à rédiger un brief."));

    const conversations = await prisma.aiConversation.findMany({ where: { userId: user.id } });
    assert.equal(conversations.length, 0, "no conversation (and no orphaned USER message) must be created on Ollama failure");
  });
});
