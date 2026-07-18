
import type { Role } from "@prisma/client";
import { z } from "zod";
import { callOllama } from "./llm.client.js";
import { getPersona } from "../agents/personas.js";
import { aiConversationService } from "./aiConversation.service.js";
import { HttpError } from "../utils/httpError.js";
import { businessMetrics } from "../observability/businessMetrics.js";

export function extractJson(text: string): string {
  // Remove markdown code blocks (both ```json and ```)
  const cleaned = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, "$1").trim();

  // Find the first occurrence of { and the corresponding closing }
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace === -1) {
    throw new Error("No JSON object found in response");
  }

  // Find the matching closing brace by counting
  let braceCount = 0;
  let lastBrace = -1;
  for (let i = firstBrace; i < cleaned.length; i++) {
    if (cleaned[i] === "{") {
      braceCount++;
    } else if (cleaned[i] === "}") {
      braceCount--;
      if (braceCount === 0) {
        lastBrace = i + 1;
        break;
      }
    }
  }

  if (lastBrace === -1) {
    throw new Error("Invalid JSON: unclosed braces");
  }

  return cleaned.slice(firstBrace, lastBrace);
}

async function callAgentWithRetry(
  personaId: string,
  contextData: Record<string, any>,
  schema: z.ZodType<any>,
  maxRetries = 1
): Promise<any> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const persona = getPersona(personaId);
      const systemPrompt = persona.systemPrompt;

      // Build user message with context data
      const userMessage = `Context data:\n${JSON.stringify(contextData, null, 2)}`;

      const messages = [
        { role: "user", content: userMessage }
      ];

      if (attempt > 0 && lastError) {
        // Add error feedback for retry
        messages.unshift({
          role: "user",
          content: `Previous attempt failed with error: ${lastError.message}. Please ensure your response is valid JSON according to the schema.`
        });
      }

      const responseText = await callOllama(messages, systemPrompt);
      const jsonString = extractJson(responseText);
      const parsedJson = JSON.parse(jsonString);
      return schema.parse(parsedJson);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error("Failed to get valid response from agent");
}

export const agentOrchestratorService = {
  async executeAgent(
    personaId: string,
    contextData: Record<string, any>,
    userId: string,
    userRole: Role
  ) {
    // Check user role
    if (!["ADMIN", "MANAGER"].includes(userRole)) {
      throw new HttpError(403, "Insufficient permissions");
    }

    const persona = getPersona(personaId);
    if (!persona) {
      throw new HttpError(404, "Persona not found");
    }

    const startTime = Date.now();
    let success = false;
    let parsedSuccessfully = false;

    try {
      // Determine the schema based on persona
      let schema: z.ZodType<any>;
      if (personaId === "brief-generator") {
        schema = z.object({
          cahier_des_charges: z.string(),
          roadmap_etapes: z.array(z.string()),
          duree_estimee_semaines: z.number()
        });
      } else if (personaId === "task-planner") {
        schema = z.object({
          taches: z.array(
            z.object({
              titre: z.string(),
              description: z.string(),
              priorite: z.string(),
              estimation_heures: z.number()
            })
          )
        });
      } else {
        throw new HttpError(400, "Unsupported persona");
      }

      // Call agent with retry
      const result = await callAgentWithRetry(personaId, contextData, schema);
      parsedSuccessfully = true;
      success = true;

      // Persist conversation
      const conversation = await aiConversationService.create(
        userId,
        JSON.stringify({ persona: personaId, context: contextData, result }),
        personaId
      );

      return {
        success: true,
        data: result,
        conversationId: conversation.conversation.id
      };
    } finally {
      // Log metrics
      const duration = Date.now() - startTime;
      businessMetrics.logAgentCall(personaId, duration, success, parsedSuccessfully);
    }
  }
};
