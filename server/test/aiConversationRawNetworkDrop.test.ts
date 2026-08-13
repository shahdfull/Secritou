// SEC-110: distinct from SEC-082 (aiConversationStreamCancellation.test.ts). SEC-082 reproduces a
// CLEAN client-initiated close — the client's own socket is destroyed, which sends a real FIN/RST
// the server's OS immediately reports, so res.on("close") fires right away. This test reproduces a
// RAW network drop instead: a local TCP proxy relays bytes between the test's HTTP client and the
// real app server, and the proxy's socket to the SERVER is destroyed without any FIN/RST ever
// reaching the server — exactly what a real Wi-Fi/ISP cutoff looks like from the server's point of
// view (the socket object is still there; the OS just doesn't know the peer is gone yet).
//
// Investigated empirically before writing the fix (throwaway repro script, not committed): without
// any write attempt after such a drop, res.on("close") stays completely silent — TCP only surfaces
// a dead peer on the next write attempt, and a long "thinking" gap between onChunk calls (or between
// tool round trips) can span many seconds with nothing written. The fix
// (aiConversation.controller.ts's HEARTBEAT_INTERVAL_MS) writes an SSE comment line (`: ping\n\n`,
// invisible to any real client — see aiConversations.api.ts's frame parser, which only reacts to
// "event:"/"data:" lines) every 5s specifically to force a write attempt regularly, so a dead socket
// is never more than one heartbeat away from being noticed. res.on("error") is also listened for
// alongside "close", since the failing heartbeat write can surface as either depending on exactly
// when Node's stream implementation notices the failure.
//
// Same real-stack requirement as SEC-082: a real listening server on a real ephemeral TCP port (not
// supertest/superagent, whose req.abort() was already shown not to close the underlying socket the
// way a real disconnect does). globalThis.fetch is mocked (deliberately slow/silent, matching the
// "model is thinking" gap) so the exact timing of the drop relative to the heartbeat is controllable
// and this test doesn't depend on a real Ollama round trip.

import test, { describe, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import bcrypt from "bcryptjs";

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "a".repeat(32);
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "b".repeat(32);
process.env.JWT_ISSUER = process.env.JWT_ISSUER ?? "secritou-api";
process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? "secritou-web";
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

let prisma: typeof import("../src/config/prisma.js").prisma;
let getRedisClient: typeof import("../src/cache/redis.js").getRedisClient;
let closeRedisClient: typeof import("../src/cache/redis.js").closeRedisClient;
let dbAvailable = true;
let originalFetch: typeof fetch;
let server: http.Server;
let serverPort: number;

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
  ({ getRedisClient, closeRedisClient } = await import("../src/cache/redis.js"));
  const { app } = await import("../src/app.js");
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  serverPort = typeof address === "object" && address ? address.port : 0;
});

after(async () => {
  if (server) {
    // The raw-drop scenario this file tests deliberately leaves the app server's own socket for
    // that connection in a half-open TCP state (no FIN/RST ever reached it) — closeAllConnections()
    // forces it closed from the server side instead of waiting on the OS's own (much slower, and in
    // a container/CI environment not reliably bounded) dead-peer detection, which otherwise keeps
    // this test process from exiting on its own after the test itself has already passed.
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  if (!dbAvailable) return;
  await prisma.aiToolCall.deleteMany({ where: { conversationId: { in: createdConversationIds } } });
  await prisma.aiMessage.deleteMany({ where: { conversationId: { in: createdConversationIds } } });
  await prisma.aiConversation.deleteMany({ where: { id: { in: createdConversationIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  // authenticate() (auth.middleware.ts) triggers a Redis connection via authDenylist.ts on every
  // authenticated request this test makes. Race-proofed by awaiting getRedisClient() first (so
  // closeRedisClient() targets the same in-flight connection this test itself triggered, not a
  // still-null client — same shape as authDenylist.test.ts's before()).
  await getRedisClient();
  await closeRedisClient();
  // Diagnosed empirically (throwaway process._getActiveHandles() dumps, not committed) before
  // adding this: even after every explicit cleanup above, this file's real network I/O (the raw TCP
  // proxy, the app server's own half-open socket for the dropped connection, Redis) can still leave
  // a handle Node doesn't release promptly when this single file is run in isolation on this dev
  // machine — the reference SEC-082 test (aiConversationStreamCancellation.test.ts), which shares
  // the same real-server/mocked-fetch shape, has the identical trait in isolation and is already
  // green in CI as part of the full run-all.test.ts suite (which has its own broader Redis/BullMQ
  // teardown covering what an isolated single file does not). Forcibly destroying any socket handle
  // still open at this point is a scoped, last-resort safety net for isolated single-file runs of
  // this test — never appropriate for production code, where an unexpected socket deserves
  // investigation, not silent forced closure.
  for (const handle of (process as unknown as { _getActiveHandles(): { destroy?(): void }[] })._getActiveHandles()) {
    handle.destroy?.();
  }
});

describe("addMessageStream detects a raw network drop via heartbeat and aborts the turn (SEC-110)", () => {
  test("a TCP-level drop (proxy socket destroyed, no FIN/RST to the server) fires close/error, aborts the signal, and persists no ASSISTANT message", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }

    const uniq = Date.now();
    const email = `sec110-${uniq}@test.local`;
    const passwordHash = await bcrypt.hash("Password123!", 10);
    const user = await prisma.user.create({ data: { name: `SEC110 user ${uniq}`, email, passwordHash, role: "ADMIN" } });
    createdUserIds.push(user.id);
    const conv = await prisma.aiConversation.create({ data: { userId: user.id, title: "test" } });
    createdConversationIds.push(conv.id);

    const loginBody = await new Promise<{ data: { tokens: { accessToken: string } } }>((resolve, reject) => {
      const req = http.request(`http://127.0.0.1:${serverPort}/api/v1/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" } }, (res) => {
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
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(JSON.stringify({ message: { role: "assistant", content: "premiere partie " }, done: false }) + "\n"));
          resolveFirstChunkSent();
          // Deliberately silent for a long stretch after the first token — this is the "model
          // thinking mid-generation" gap that leaves no write attempt to surface a dead socket
          // without the heartbeat. Unlike a blocking `await new Promise(() => {})`, this mock stays
          // idle by simply never enqueuing again — real fetch() ties its Response.body to the
          // signal automatically (aborting cancels the stream), which a hand-rolled mock does not
          // get for free, so it's wired explicitly here: without this listener, the generator
          // consuming this stream (llm.client.ts#streamOllamaWithTools) stays parked on its pending
          // reader.read() forever even after abortController.signal fires, leaving the test process
          // unable to exit.
          init?.signal?.addEventListener("abort", () => {
            controller.error(new DOMException("The operation was aborted.", "AbortError"));
          });
        },
      });
      return new Response(stream, { status: 200, headers: { "Content-Type": "application/x-ndjson" } });
    });

    // Raw TCP proxy: test client -> proxy -> app server. Destroying the proxy's socket to the
    // SERVER (not the client's socket to the proxy) means the server's OS-level connection dies
    // with no FIN/RST ever sent — the same blind spot a real network cutoff leaves.
    let proxyToServerSocket: net.Socket | undefined;
    let proxyToClientSocket: net.Socket | undefined;
    const proxy = net.createServer((clientSocket) => {
      proxyToClientSocket = clientSocket;
      const upstream = net.connect({ host: "127.0.0.1", port: serverPort }, () => {
        proxyToServerSocket = upstream;
        clientSocket.pipe(upstream);
        upstream.pipe(clientSocket);
      });
      upstream.on("error", () => {});
      clientSocket.on("error", () => {});
    });
    await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", () => resolve()));
    const proxyAddress = proxy.address();
    const proxyPort = typeof proxyAddress === "object" && proxyAddress ? proxyAddress.port : 0;

    // Kept in the outer scope so the finally block can force-close every socket this test opened —
    // net.Server.close() alone only stops accepting NEW connections, it does not close sockets
    // already established, which otherwise keeps the test process alive indefinitely (the mocked
    // fetch's ReadableStream.start() also never resolves on its own, by design — see its comment).
    let testClientReq: http.ClientRequest | undefined;

    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.request(
          { host: "127.0.0.1", port: proxyPort, path: `/api/v1/ai/conversations/${conv.id}/messages/stream`, method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` } },
          (res) => {
            res.on("data", () => {
              firstChunkSent.then(() => {
                if (!proxyToServerSocket) { reject(new Error("proxy never connected upstream")); return; }
                // The raw drop: destroy the PROXY's socket to the server, not the client's socket
                // to the proxy. The server never sees a FIN/RST — only a heartbeat write attempt
                // will surface this.
                (proxyToServerSocket as net.Socket).destroy();
                resolve();
              });
            });
            res.on("error", () => resolve());
          }
        );
        testClientReq = req;
        req.on("error", () => resolve());
        req.end(JSON.stringify({ message: "un message quelconque" }));
      });

      // HEARTBEAT_INTERVAL_MS is 5s (aiConversation.controller.ts) — wait for one full interval
      // plus margin for the write attempt and event propagation, not an arbitrary short wait.
      await new Promise((resolve) => setTimeout(resolve, 7_000));

      assert.ok(capturedSignal, "the fetch call to Ollama must have received a signal");
      assert.equal(
        capturedSignal!.aborted,
        true,
        "the signal must be aborted once the heartbeat notices the raw network drop, even with no client-initiated close"
      );

      const messagesAfterDrop = await prisma.aiMessage.findMany({ where: { conversationId: conv.id } });
      const assistantMessages = messagesAfterDrop.filter((m) => m.role === "ASSISTANT");
      assert.equal(
        assistantMessages.length,
        0,
        "no ASSISTANT message must be persisted for a turn aborted by a raw network drop"
      );
    } finally {
      globalThis.fetch = originalFetch;
      testClientReq?.destroy();
      proxyToClientSocket?.destroy();
      // proxyToServerSocket is already destroyed (that's the drop this test simulates), but destroy
      // is idempotent — calling it again on an already-destroyed socket is a safe no-op.
      proxyToServerSocket?.destroy();
      proxy.close();
    }
  });
});
