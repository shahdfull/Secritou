import type { RequestHandler } from "express";
import { aiConversationService } from "../services/aiConversation.service.js";
import { buildServiceScope } from "../utils/serviceScope.js";

export const listConversations: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.sub!;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));
    const result = await aiConversationService.list(userId, page, pageSize);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getConversation: RequestHandler = async (req, res, next) => {
  try {
    const conv = await aiConversationService.getById(
      req.params.id as string,
      req.user!.sub!
    );
    res.json({ data: conv });
  } catch (error) {
    next(error);
  }
};

export const createConversation: RequestHandler = async (req, res, next) => {
  try {
    const { message } = req.body as { message: string };
    // callerContext.userId is req.user!.id (buildServiceScope), the same value as req.user!.sub —
    // both are set from the same JWT claim (auth.service.ts) — derived once here rather than
    // twice under two different names in the same function.
    const callerContext = await buildServiceScope(req);
    const result = await aiConversationService.create(
      callerContext.userId!,
      message,
      callerContext
    );
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const addMessage: RequestHandler = async (req, res, next) => {
  try {
    const { message } = req.body as { message: string };
    const callerContext = await buildServiceScope(req);
    const result = await aiConversationService.addMessage(
      req.params.id as string,
      callerContext.userId!,
      message,
      callerContext
    );
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

// SEC-110: a raw network drop (Wi-Fi cutoff, ISP path failure — no FIN/RST reaches this process,
// unlike a client-initiated close or a locally destroyed socket) leaves res.on("close") silent
// forever if nothing ever attempts to write to the dead socket again: TCP only surfaces the failure
// on the next write attempt, and a stretch of the model "thinking" between chunks (or between tool
// round trips) can span many seconds with no onChunk call to force one. Verified empirically before
// this fix: without a periodic write, close/error stayed silent for the whole 10s of a test gap;
// with a write every HEARTBEAT_INTERVAL_MS, the dead socket surfaced within one interval. `: ping\n\n`
// is an SSE comment line (leading colon) — ignored by the spec and by this app's own parser
// (aiConversations.api.ts only reacts to "event:"/"data:" lines), so it's invisible to a healthy
// client and only exists to force Node to notice a dead one.
const HEARTBEAT_INTERVAL_MS = 5_000;

// SEC-059 follow-up: SSE variant of addMessage — same auth/scope/persistence contract, but the
// final round trip streams to the client as it's generated instead of waiting for the whole reply.
// Once headers are flushed, an error can no longer go through the normal next(error) path (Express
// would try to send a second response and throw ERR_HTTP_HEADERS_SENT) — reported as an SSE "error"
// event instead, so the client can distinguish a genuine failure from a normal stream end.
export const addMessageStream: RequestHandler = async (req, res, next) => {
  const { message } = req.body as { message: string };
  let headersSent = false;
  // SEC-082: the client closing the connection (browser tab closed, network drop, or the new
  // frontend cancel button — SEC-092) previously left the Ollama round trip running to completion
  // regardless, wasting the only Ollama worker on this CPU-only host on a request nobody is
  // waiting for anymore. res.on("close") fires on both a clean end() and an abrupt disconnect, so
  // it's guarded by headersSent below — aborting after the stream already finished normally is a
  // harmless no-op (the request is done either way).
  const abortController = new AbortController();
  res.on("close", () => {
    if (headersSent) abortController.abort();
  });
  // SEC-110: a write to a socket that died via a raw network drop can surface as an "error" event
  // on the response stream rather than (or in addition to) "close" — listening for both is what
  // actually catches the heartbeat write's failure promptly.
  res.on("error", () => {
    if (headersSent) abortController.abort();
  });
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  try {
    const callerContext = await buildServiceScope(req);
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    headersSent = true;
    heartbeat = setInterval(() => {
      if (res.writableEnded || res.destroyed) {
        clearInterval(heartbeat);
        return;
      }
      res.write(": ping\n\n");
    }, HEARTBEAT_INTERVAL_MS);

    const result = await aiConversationService.addMessageStreaming(
      req.params.id as string,
      callerContext.userId!,
      message,
      callerContext,
      (text) => {
        res.write(`event: chunk\ndata: ${JSON.stringify({ text })}\n\n`);
      },
      abortController.signal
    );

    res.write(`event: done\ndata: ${JSON.stringify({ data: result })}\n\n`);
    res.end();
  } catch (error) {
    if (!headersSent) {
      next(error);
      return;
    }
    // A client-initiated abort (tab closed, cancel button) races res.write/res.end against an
    // already-closed socket — Express/Node throw ERR_STREAM_WRITE_AFTER_END in that case, which
    // would otherwise crash this handler with an unhandled rejection. Nothing to write back to a
    // socket that's already gone.
    if (res.writableEnded || res.destroyed) return;
    // Same doctrine as the rest of this API (error.middleware.ts's HttpError branch): the raw
    // error message reaches the client verbatim, including whatever llm.client.ts interpolated
    // from Ollama's own response body on a provider error — a pre-existing pattern in this
    // codebase, not something newly introduced by streaming.
    const errorMessage = error instanceof Error ? error.message : "Ollama provider error";
    res.write(`event: error\ndata: ${JSON.stringify({ message: errorMessage })}\n\n`);
    res.end();
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
};

export const deleteConversation: RequestHandler = async (req, res, next) => {
  try {
    await aiConversationService.delete(
      req.params.id as string,
      req.user!.sub!
    );
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const importFromLocalStorage: RequestHandler = async (req, res, next) => {
  try {
    const { messages } = req.body as {
      messages: { role: "user" | "assistant"; content: string }[];
    };
    const conv = await aiConversationService.importFromLocalStorage(
      req.user!.sub!,
      messages ?? []
    );
    res.status(201).json({ data: conv });
  } catch (error) {
    next(error);
  }
};
