import { aiConversationRepository } from "../repositories/aiConversation.repository.js";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

const SYSTEM_PROMPT = `Tu es l'assistant IA de Secritou, une plateforme CRM pour agences digitales.
Tu aides les administrateurs et managers à gérer leurs leads, clients, projets, tâches, freelancers et missions.
Réponds en français de manière concise et professionnelle.
Si tu ne connais pas une information spécifique, indique-le honnêtement.`;

async function callOpenAI(messages: { role: string; content: string }[]): Promise<string> {
  if (!env.OPENAI_API_KEY) throw new HttpError(503, "AI service is not configured");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 1000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new HttpError(502, `AI provider error: ${error}`);
  }

  const data = (await response.json()) as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content ?? "Désolé, je n'ai pas pu générer de réponse.";
}

export const aiConversationService = {
  async list(companyId: string, userId: string, page: number, pageSize: number) {
    return aiConversationRepository.findAll(companyId, userId, page, pageSize);
  },

  async getById(id: string, companyId: string, userId: string) {
    const conv = await aiConversationRepository.findById(id, companyId, userId);
    if (!conv) throw new HttpError(404, "Conversation not found");
    return conv;
  },

  async create(companyId: string, userId: string, firstMessage: string) {
    // Auto-generate title from the first message (truncate to 60 chars)
    const title = firstMessage.slice(0, 60) + (firstMessage.length > 60 ? "…" : "");
    const conv = await aiConversationRepository.create(companyId, userId, title);

    // Persist user message, call OpenAI, persist reply
    await aiConversationRepository.addMessage(conv.id, "user", firstMessage);

    const history = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: firstMessage },
    ];
    const reply = await callOpenAI(history);
    const assistantMsg = await aiConversationRepository.addMessage(conv.id, "assistant", reply);

    return { conversation: conv, reply: assistantMsg };
  },

  async addMessage(id: string, companyId: string, userId: string, content: string) {
    const conv = await aiConversationRepository.findById(id, companyId, userId);
    if (!conv) throw new HttpError(404, "Conversation not found");

    await aiConversationRepository.addMessage(conv.id, "user", content);

    // Build history for OpenAI (last 20 messages to respect token limits)
    const recentMessages = conv.messages.slice(-20);
    const history = [
      { role: "system", content: SYSTEM_PROMPT },
      ...recentMessages.map((m) => ({ role: m.role as string, content: m.content })),
      { role: "user", content },
    ];
    const reply = await callOpenAI(history);
    const assistantMsg = await aiConversationRepository.addMessage(conv.id, "assistant", reply);

    return { reply: assistantMsg };
  },

  async delete(id: string, companyId: string, userId: string) {
    const conv = await aiConversationRepository.findById(id, companyId, userId);
    if (!conv) throw new HttpError(404, "Conversation not found");
    await aiConversationRepository.delete(id, companyId, userId);
  },

  async importFromLocalStorage(
    companyId: string,
    userId: string,
    messages: { role: "user" | "assistant"; content: string }[]
  ) {
    if (!messages.length) return null;
    const conv = await aiConversationRepository.create(companyId, userId, "Historique importé");
    for (const msg of messages) {
      await aiConversationRepository.addMessage(conv.id, msg.role, msg.content);
    }
    return conv;
  },
};
