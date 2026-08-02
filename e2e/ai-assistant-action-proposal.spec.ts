import { type APIRequestContext } from "@playwright/test";
import { test, expect } from "./fixtures";

// Phase 3 point 1 of the QA mandate: the AI module's own full journey (question -> proposal
// confirmation -> real effect verified in the database), exercised through the real browser
// against the real running server and the real local Ollama model — not a mock of the LLM layer.
// Deliberately NOT part of a shared parallel run: a single Ollama turn on this CPU-only machine
// already takes 30-90s, and the assistant never runs in the load-bearing default e2e suite for
// that reason — run this file on its own when validating the AI module specifically.

const API_BASE = "http://localhost:5000/api/v1";

async function loginAsAdmin(request: APIRequestContext) {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { email: "admin@secritou.tn", password: "admin123" },
  });
  const body = await res.json();
  return body.data.tokens.accessToken as string;
}

test("asking the assistant to create a task proposes it, and confirming it creates a real Task row", async ({ page, request }) => {
  test.setTimeout(240_000);
  const accessToken = await loginAsAdmin(request);
  const uniq = Date.now();

  // A real project to attach the proposed task to — the assistant's proposeCreateTask tool needs
  // a real project it can resolve by name from the model's own free-text answer.
  const clientRes = await request.post(`${API_BASE}/clients`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { name: `E2E AI Client ${uniq}` },
  });
  const client = (await clientRes.json()).data;
  const proposalRes = await request.post(`${API_BASE}/proposals`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { title: `E2E AI Proposal ${uniq}`, amount: 1000, currency: "TND", clientId: client.id },
  });
  const proposal = (await proposalRes.json()).data;
  await request.post(`${API_BASE}/proposals/${proposal.id}/send`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const acceptRes = await request.post(`${API_BASE}/proposals/${proposal.id}/accept`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const acceptBody = await acceptRes.json();
  const projectRes = await request.get(`${API_BASE}/projects/${acceptBody.meta.projectId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const project = (await projectRes.json()).data;
  const taskTitle = `E2E AI Task ${uniq}`;

  await page.goto("/login");
  await page.locator("#login-email").fill("admin@secritou.tn");
  await page.locator("#login-password").fill("admin123");
  await page.getByRole("button", { name: /Se connecter/i }).click();
  await expect(page).toHaveURL(/\/app$/);

  // /app/ai has no sidebar link (only reachable via the AIAssistantFloat widget or a direct URL) —
  // navigating directly, same destination a user clicking that widget would land on.
  await page.goto("/app/ai");

  // proposeCreateTask requires a real projectId (a UUID), not a free-text project name — the
  // system prompt expects the model to resolve one via getProjects first, but qwen2.5:3b (the
  // small local model this runs against) isn't reliable at chaining two tool calls in one turn.
  // Giving the id directly tests the actual point of this journey (the confirm-then-real-write
  // path) without depending on that separate tool-routing behavior, already covered by
  // aiTools.test.ts/llmClientToolCalling.test.ts.
  const chatInput = page.getByPlaceholder(/Écrivez votre message/i);
  await chatInput.fill(
    `Crée une tâche intitulée "${taskTitle}" sur le projet d'id ${project.id}.`
  );
  await page.getByRole("button", { name: /Envoyer/i }).click();

  // A real Ollama turn on this CPU-only machine — bounded by the test's own 120s timeout above,
  // not an arbitrary short wait.
  const confirmButton = page.getByRole("button", { name: /Confirmer/i });
  await expect(confirmButton).toBeVisible({ timeout: 220_000 });
  await confirmButton.click();

  // Confirm the real Task row now exists (not just a success toast) — the actual point of this
  // journey: the model never writes directly (aiActionProposals.ts), only a real user click does.
  const tasksRes = await request.get(`${API_BASE}/tasks?projectId=${project.id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const tasksBody = await tasksRes.json();
  const task = tasksBody.data.find((t: { title: string }) => t.title === taskTitle);
  expect(task, "confirming the AI's proposal must have created a real Task row").toBeTruthy();
});
