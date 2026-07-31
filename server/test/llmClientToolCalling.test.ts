// SEC-059: callOllamaWithTools must (a) attach the `tools` array to the request body sent to
// Ollama, (b) return tool_calls as-is when the model asks for one instead of answering directly,
// and (c) still reject an empty response the same way SEC-039 already does for the no-tools path
// (empty content AND no tool_calls). This test calls the real callOllamaWithTools, mocking only
// globalThis.fetch (a plain Node primitive — mock.method works on it directly, unlike the
// $extends-wrapped Prisma client seen elsewhere in this repo, cf. SEC-009), following the same
// pattern as llmClientEmptyResponse.test.ts.

import test, { describe, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../src/utils/httpError.js";
import { AI_TOOL_DEFINITIONS } from "../src/services/aiTools.js";

let callOllamaWithTools: typeof import("../src/services/llm.client.js").callOllamaWithTools;
let originalFetch: typeof fetch;

before(async () => {
  ({ callOllamaWithTools } = await import("../src/services/llm.client.js"));
});

after(() => {
  mock.reset();
});

describe("callOllamaWithTools (SEC-059)", () => {
  test("sends the tools array in the request body", async () => {
    originalFetch = globalThis.fetch;
    let capturedBody: { tools?: unknown } | undefined;
    mock.method(globalThis, "fetch", async (_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init!.body as string) as { tools?: unknown };
      return new Response(JSON.stringify({ message: { role: "assistant", content: "bonjour" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    try {
      await callOllamaWithTools([{ role: "user", content: "salut" }], AI_TOOL_DEFINITIONS);
      assert.ok(capturedBody?.tools, "the tools array must be attached to the request body");
      assert.equal((capturedBody!.tools as unknown[]).length, AI_TOOL_DEFINITIONS.length);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("returns tool_calls as-is when the model requests a tool instead of answering", async () => {
    originalFetch = globalThis.fetch;
    mock.method(globalThis, "fetch", async () =>
      new Response(
        JSON.stringify({
          message: {
            role: "assistant",
            content: "",
            tool_calls: [{ function: { name: "getProjects", arguments: { search: "acme" } } }],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    try {
      const message = await callOllamaWithTools([{ role: "user", content: "mes projets ?" }], AI_TOOL_DEFINITIONS);
      assert.equal(message.content, "");
      assert.equal(message.tool_calls?.length, 1);
      assert.equal(message.tool_calls?.[0]?.function.name, "getProjects");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("rejects a response with neither content nor tool_calls (SEC-039 doctrine extended)", async () => {
    originalFetch = globalThis.fetch;
    mock.method(globalThis, "fetch", async () =>
      new Response(JSON.stringify({ message: { role: "assistant", content: "" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    try {
      await assert.rejects(
        () => callOllamaWithTools([{ role: "user", content: "hi" }], AI_TOOL_DEFINITIONS),
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

  test("forwards a shared AbortSignal through to fetch instead of always creating its own per-call timeout", async () => {
    originalFetch = globalThis.fetch;
    let capturedSignal: AbortSignal | undefined;
    mock.method(globalThis, "fetch", async (_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined;
      return new Response(JSON.stringify({ message: { role: "assistant", content: "ok" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const sharedSignal = AbortSignal.timeout(180_000);
    try {
      await callOllamaWithTools([{ role: "user", content: "hi" }], AI_TOOL_DEFINITIONS, undefined, sharedSignal);
      assert.equal(capturedSignal, sharedSignal, "the caller-provided signal must reach fetch as-is, not be replaced by a fresh per-call timeout");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("an already-aborted shared signal rejects the call immediately, mid tool-calling loop", async () => {
    originalFetch = globalThis.fetch;
    const controller = new AbortController();
    controller.abort();
    mock.method(globalThis, "fetch", async (_url: string, init?: RequestInit) => {
      // Mirrors real fetch behavior: an already-aborted signal rejects before the request is sent.
      if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return new Response(JSON.stringify({ message: { role: "assistant", content: "ok" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    try {
      await assert.rejects(
        () => callOllamaWithTools([{ role: "user", content: "hi" }], AI_TOOL_DEFINITIONS, undefined, controller.signal),
        (err: unknown) => err instanceof DOMException && err.name === "AbortError"
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
