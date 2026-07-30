// SEC-039: callOllama used to silently fall back to a fixed placeholder string
// ("Désolé, je n'ai pas pu générer de réponse.") when Ollama returned 200 with an empty/missing
// message.content, indistinguishable from a genuine model reply once persisted as an ASSISTANT
// message. Fixed to throw a real HttpError(502) instead.
//
// This test calls the real callOllama (not a reimplementation), mocking only the global fetch
// (a plain Node primitive, not a Prisma-extended delegate — mock.method works on it directly,
// unlike the $extends-wrapped Prisma client seen elsewhere in this repo, cf. SEC-009) to return
// the exact empty-content shape Ollama's /api/chat would send.
//
// process.env.OLLAMA_URL cannot be used here to redirect the call: env.ts resolves and freezes
// OLLAMA_URL at first import of that module (env = envSchema.parse(process.env)), which — in the
// full test:unit run — already happened via an earlier-imported file before this one's before()
// runs, so a late process.env override has no effect on it.

import test, { describe, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../src/utils/httpError.js";

let callOllama: typeof import("../src/services/llm.client.js").callOllama;
let originalFetch: typeof fetch;

before(async () => {
  ({ callOllama } = await import("../src/services/llm.client.js"));
});

after(() => {
  mock.reset();
});

describe("callOllama rejects an empty response instead of a silent placeholder (SEC-039)", () => {
  test("throws HttpError 502 when Ollama returns 200 with empty content", async () => {
    originalFetch = globalThis.fetch;
    mock.method(globalThis, "fetch", async () =>
      new Response(JSON.stringify({ message: { content: "" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    try {
      await assert.rejects(
        () => callOllama([{ role: "user", content: "hi" }]),
        (err: unknown) => {
          assert.ok(err instanceof HttpError);
          assert.equal((err as InstanceType<typeof HttpError>).statusCode, 502);
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
