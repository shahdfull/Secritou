import { z } from "zod";

const chatMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const chatSchema = z.object({
  body: z.object({
    message: z.string().min(1).max(4000),
    history: z.array(chatMessage).max(20).default([]),
  }),
});

// SEC-034: context used to be z.record(z.any()) with no size bound — a single call could inflate
// the prompt sent to Ollama arbitrarily (cost/latency), with only aiRateLimit (call frequency)
// as protection. 20000 chars matches the bound already used for CV extraction
// (cvExtraction.service.ts) as the accepted size for "a chunk of prose/structured text an agent
// reasons over" in this codebase.
const MAX_CONTEXT_SERIALIZED_LENGTH = 20000;
const agentContext = z.record(z.any()).refine(
  (value) => JSON.stringify(value).length <= MAX_CONTEXT_SERIALIZED_LENGTH,
  { message: `context is too large (max ${MAX_CONTEXT_SERIALIZED_LENGTH} serialized characters)` }
);

export const generateBriefSchema = z.object({
  body: z.object({
    context: agentContext,
  }),
});

export const generateTasksSchema = z.object({
  body: z.object({
    context: agentContext,
  }),
});
