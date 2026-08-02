// SEC-082: addMessageStream (aiConversation.controller.ts) never listened for the client closing
// the connection — the only AbortSignal in play was the wall-clock turnDeadline, never tied to the
// HTTP connection itself. A client abandoning the SSE stream mid-generation left the Ollama round
// trip running to completion regardless, wasting the only Ollama worker on this CPU-only host and
// still persisting the full ASSISTANT reply once it eventually finished. Fixed by creating an
// AbortController in the controller and calling .abort() from res.on("close") (guarded by
// headersSent so a normal stream end is never mistaken for an abort).
//
// This test calls the real HTTP stack over a real TCP socket (app.ts listening on an ephemeral
// port, a raw http.request() client whose socket is destroyed mid-stream) — supertest/superagent's
// req.abort() was tried first but never actually closed the underlying socket the way a real
// client disconnecting does, so res.on("close") never fired. A real listening server + a real
// destroyed socket is what actually reproduces this. Mocks only globalThis.fetch with a
// deliberately slow, abortable stream so the fetch signal argument itself can be asserted on — not
// a reimplementation of the controller's close-handling logic.

import test, { describe, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import bcrypt from "bcryptjs";

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "a".repeat(32);
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "b".repeat(32);
process.env.JWT_ISSUER = process.env.JWT_ISSUER ?? "secritou-api";
process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? "secritou-web";
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

let prisma: typeof import("../src/config/prisma.js").prisma;
let dbAvailable = true;
let originalFetch: typeof fetch;
let server: http.Server;
let baseUrl: string;

const createdUserIds: string[] = [];
const createdConversationIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
    return;
  }
  const { app } = await import("../src/app.js");
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (!dbAvailable) return;
  await prisma.aiToolCall.deleteMany({ where: { conversationId: { in: createdConversationIds } } });
  await prisma.aiMessage.deleteMany({ where: { conversationId: { in: createdConversationIds } } });
  await prisma.aiConversation.deleteMany({ where: { id: { in: createdConversationIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe("addMessageStream aborts the Ollama call when the client disconnects (SEC-082)", () => {
  test("fetch to Ollama receives an already-fired abort signal once the client socket is destroyed mid-stream", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }

    const uniq = Date.now();
    const email = `sec082-${uniq}@test.local`;
    const passwordHash = await bcrypt.hash("Password123!", 10);
    const user = await prisma.user.create({ data: { name: `SEC082 user ${uniq}`, email, passwordHash, role: "ADMIN" } });
    createdUserIds.push(user.id);
    const conv = await prisma.aiConversation.create({ data: { userId: user.id, title: "test" } });
    createdConversationIds.push(conv.id);

    const loginBody = await new Promise<{ data: { tokens: { accessToken: string } } }>((resolve, reject) => {
      const req = http.request(`${baseUrl}/api/v1/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" } }, (res) => {
        let body = "";
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => resolve(JSON.parse(body)));
      });
      req.on("error", reject);
      req.end(JSON.stringify({ email, password: "Password123!" }));
    });
    const accessToken = loginBody.data.tokens.accessToken;

    let capturedSignal: AbortSignal | undefined;
    let resolveFirstChunkSent: () => void;
    const firstChunkSent = new Promise<void>((resolve) => { resolveFirstChunkSent = resolve; });

    originalFetch = globalThis.fetch;
    mock.method(globalThis, "fetch", async (_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined;
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(JSON.stringify({ message: { role: "assistant", content: "premiere partie " }, done: false }) + "\n"));
          resolveFirstChunkSent();
          // Never resolves on its own — the real assertion is whether destroying the client
          // socket aborts capturedSignal, not whether this stream ever "ends" naturally.
          await new Promise(() => {});
        },
      });
      return new Response(stream, { status: 200, headers: { "Content-Type": "application/x-ndjson" } });
    });

    try {
      await new Promise<void>((resolve) => {
        const req = http.request(
          `${baseUrl}/api/v1/ai/conversations/${conv.id}/messages/stream`,
          { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` } },
          (res) => {
            res.on("data", () => {
              // Once real SSE bytes have arrived, destroy the underlying socket — the same thing
              // a browser tab closing or a network drop does, which is what res.on("close") in
              // the controller is listening for.
              firstChunkSent.then(() => {
                req.destroy();
                resolve();
              });
            });
            res.on("error", () => resolve());
          }
        );
        req.on("error", () => resolve());
        req.end(JSON.stringify({ message: "un message quelconque" }));
      });

      // Give the controller's res.on("close") handler a moment to fire and call abort().
      await new Promise((resolve) => setTimeout(resolve, 300));

      assert.ok(capturedSignal, "the fetch call to Ollama must have received a signal");
      assert.equal(capturedSignal!.aborted, true, "the signal must be aborted once the client disconnects mid-stream");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
