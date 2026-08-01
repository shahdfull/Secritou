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
let streamOllamaWithTools: typeof import("../src/services/llm.client.js").streamOllamaWithTools;
let env: typeof import("../src/config/env.js").env;
let originalFetch: typeof fetch;

before(async () => {
  ({ callOllamaWithTools, streamOllamaWithTools } = await import("../src/services/llm.client.js"));
  ({ env } = await import("../src/config/env.js"));
});

// Builds a Response whose body streams the given NDJSON lines one chunk at a time — mirrors what
// Ollama's real /api/chat sends with stream: true (one JSON object per line, no separators).
function ndjsonResponse(objects: unknown[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const obj of objects) {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      }
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "application/x-ndjson" } });
}

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

  test("sends num_ctx and num_predict from env in the request options (context-window/generation-length tuning)", async () => {
    originalFetch = globalThis.fetch;
    let capturedOptions: { num_ctx?: number; num_predict?: number } | undefined;
    mock.method(globalThis, "fetch", async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(init!.body as string) as { options?: { num_ctx?: number; num_predict?: number } };
      capturedOptions = body.options;
      return new Response(JSON.stringify({ message: { role: "assistant", content: "bonjour" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    try {
      await callOllamaWithTools([{ role: "user", content: "salut" }], AI_TOOL_DEFINITIONS);
      assert.equal(capturedOptions?.num_ctx, env.OLLAMA_NUM_CTX);
      assert.equal(capturedOptions?.num_predict, env.OLLAMA_NUM_PREDICT);
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

describe("streamOllamaWithTools (SEC-059 follow-up: streaming)", () => {
  test("sends num_ctx and num_predict from env in the request options (context-window/generation-length tuning)", async () => {
    originalFetch = globalThis.fetch;
    let capturedOptions: { num_ctx?: number; num_predict?: number } | undefined;
    mock.method(globalThis, "fetch", async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(init!.body as string) as { options?: { num_ctx?: number; num_predict?: number } };
      capturedOptions = body.options;
      return ndjsonResponse([{ message: { role: "assistant", content: "Bonjour" }, done: true }]);
    });

    try {
      for await (const _event of streamOllamaWithTools([{ role: "user", content: "salut" }], AI_TOOL_DEFINITIONS)) {
        // drain
      }
      assert.equal(capturedOptions?.num_ctx, env.OLLAMA_NUM_CTX);
      assert.equal(capturedOptions?.num_predict, env.OLLAMA_NUM_PREDICT);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("yields content deltas as they stream in, accumulating to the full reply", async () => {
    originalFetch = globalThis.fetch;
    mock.method(globalThis, "fetch", async () =>
      ndjsonResponse([
        { message: { role: "assistant", content: "Bon" }, done: false },
        { message: { role: "assistant", content: "jour" }, done: false },
        { message: { role: "assistant", content: "!" }, done: true },
      ])
    );

    try {
      const events: string[] = [];
      let reply = "";
      for await (const event of streamOllamaWithTools([{ role: "user", content: "salut" }], AI_TOOL_DEFINITIONS)) {
        if (event.type === "content") {
          events.push(event.text);
          reply += event.text;
        }
      }
      assert.deepEqual(events, ["Bon", "jour", "!"]);
      assert.equal(reply, "Bonjour!");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("yields a tool_calls event instead of content when the model requests a tool", async () => {
    originalFetch = globalThis.fetch;
    mock.method(globalThis, "fetch", async () =>
      ndjsonResponse([
        {
          message: {
            role: "assistant",
            content: "",
            tool_calls: [{ function: { name: "getTasks", arguments: { overdue: true } } }],
          },
          done: true,
        },
      ])
    );

    try {
      const events: Array<{ type: string }> = [];
      for await (const event of streamOllamaWithTools([{ role: "user", content: "tâches en retard ?" }], AI_TOOL_DEFINITIONS)) {
        events.push(event);
      }
      assert.equal(events.length, 1);
      assert.equal(events[0]?.type, "tool_calls");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("rejects a stream that ends with neither content nor tool_calls (SEC-039 doctrine extended)", async () => {
    originalFetch = globalThis.fetch;
    mock.method(globalThis, "fetch", async () => ndjsonResponse([{ message: { role: "assistant", content: "" }, done: true }]));

    try {
      await assert.rejects(
        async () => {
          for await (const _event of streamOllamaWithTools([{ role: "user", content: "hi" }], AI_TOOL_DEFINITIONS)) {
            // drain
          }
        },
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

  test("a chunk split across two stream reads is still parsed correctly (partial-line buffering)", async () => {
    originalFetch = globalThis.fetch;
    // Simulates a single JSON line arriving split across two separate TCP reads — the NDJSON
    // parser must buffer the incomplete line rather than trying to JSON.parse a half-line.
    const fullLine = JSON.stringify({ message: { role: "assistant", content: "Bonjour" }, done: true }) + "\n";
    const splitPoint = Math.floor(fullLine.length / 2);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(fullLine.slice(0, splitPoint)));
        controller.enqueue(encoder.encode(fullLine.slice(splitPoint)));
        controller.close();
      },
    });
    mock.method(globalThis, "fetch", async () => new Response(stream, { status: 200 }));

    try {
      let reply = "";
      for await (const event of streamOllamaWithTools([{ role: "user", content: "hi" }], AI_TOOL_DEFINITIONS)) {
        if (event.type === "content") reply += event.text;
      }
      assert.equal(reply, "Bonjour");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
