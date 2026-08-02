import { type APIRequestContext } from "@playwright/test";
import { test, expect } from "./fixtures";

// Phase 3 point 1 of the QA mandate: a full business journey (lead -> client -> project -> task
// -> invoicing), exercised through the real browser against the real running server end to end —
// not a reimplementation of any single layer. Data is created fresh per run via the API (not
// depending on specific seeded rows staying in a given state across repeated runs, same doctrine
// as proposal-cascade.spec.ts), but the UI itself drives every state transition asserted here.

const API_BASE = "http://localhost:5000/api/v1";

async function loginAsAdmin(request: APIRequestContext) {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { email: "admin@secritou.tn", password: "admin123" },
  });
  const body = await res.json();
  return body.data.tokens.accessToken as string;
}

test("lead becomes a client, gets a project and a task, and is invoiced (full journey, real browser + real server)", async ({ page, request }) => {
  const accessToken = await loginAsAdmin(request);
  const uniq = Date.now();
  const leadName = `E2E Journey Lead ${uniq}`;
  const leadEmail = `e2e-journey-${uniq}@test.local`;

  // A lead must be WON with an email before it can be converted (leadService.convertLeadToClient) —
  // created directly at WON via the API since the UI status transitions themselves are already
  // covered elsewhere; this test's own scope is the cross-entity journey, not the lead pipeline.
  const leadRes = await request.post(`${API_BASE}/leads`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { name: leadName, email: leadEmail, status: "WON" },
  });
  const lead = (await leadRes.json()).data;

  await page.goto("/login");
  await page.locator("#login-email").fill("admin@secritou.tn");
  await page.locator("#login-password").fill("admin123");
  await page.getByRole("button", { name: /Se connecter/i }).click();
  await expect(page).toHaveURL(/\/app$/);

  // Step 1: lead -> client, via the real CRM UI.
  await page.getByRole("link", { name: "CRM" }).click();
  const leadSearchBox = page.getByPlaceholder(/[Rr]echercher/).first();
  await leadSearchBox.fill(leadName);
  await expect(leadSearchBox).toHaveValue(leadName);
  // LeadsPage debounces the search input 300ms (useDebouncedValue) before firing the real
  // server-filtered request (setSearch -> useListParams) — the input's own committed value is
  // confirmed above, but the row itself won't reflect the filtered result until well past that
  // debounce window, plus the fetch/re-render itself under this machine's CPU-only load.
  const leadRow = page.getByRole("row", { name: new RegExp(leadName) });
  await expect(leadRow).toBeVisible({ timeout: 15000 });
  await leadRow.getByTitle(/[Cc]onvertir/).click();
  const convertDialog = page.getByRole("dialog").filter({ hasText: leadName });
  await expect(convertDialog).toBeVisible();
  await convertDialog.getByRole("button", { name: /[Cc]onvertir/i }).click();
  // The mutation itself (real API round trip + 2 cache invalidations) can take longer than
  // Playwright's 5s default under this machine's CPU-only load, especially right after other
  // specs in the same run have already exercised the server — same doctrine as the longer
  // timeouts already applied to the search-filtered row lookups above.
  await expect(convertDialog).toHaveCount(0, { timeout: 15000 });

  // Confirm the real Client row now exists (not just a success toast) by querying the API with
  // the same access token the browser session is using.
  const clientsRes = await request.get(`${API_BASE}/clients?search=${encodeURIComponent(leadName)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const clientsBody = await clientsRes.json();
  const client = clientsBody.data.find((c: { name: string }) => c.name === leadName);
  expect(client, "the lead conversion must have created a real Client row").toBeTruthy();

  // Step 2: client -> project. A Project can ONLY be created via a proposal's acceptance
  // (proposal.service.ts#acceptWithCascade) — SEC-039/046/057 removed any direct "New project"
  // button by design, so this journey creates and sends the proposal via the API (that specific
  // UI flow is already covered by e2e/proposal-cascade.spec.ts) and accepts it via the real
  // Proposals UI, the same way proposal-cascade.spec.ts does.
  const proposalTitle = `E2E Journey Proposal ${uniq}`;
  const createProposalRes = await request.post(`${API_BASE}/proposals`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { title: proposalTitle, amount: 5000, currency: "TND", clientId: client.id },
  });
  const proposal = (await createProposalRes.json()).data;
  await request.post(`${API_BASE}/proposals/${proposal.id}/send`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  await page.getByRole("link", { name: "Propositions" }).click();
  const proposalSearchBox = page.getByPlaceholder(/[Rr]echercher des propositions/i);
  await proposalSearchBox.fill(proposalTitle);
  await expect(proposalSearchBox).toHaveValue(proposalTitle);
  const proposalRow = page.getByRole("row", { name: new RegExp(proposalTitle) });
  await expect(proposalRow).toBeVisible({ timeout: 15000 });
  // The Accept button's own title attribute swaps to a status-gate message (statusGateTitle)
  // until ProposalsPage's own data confirms status is SENT/VIEWED (canRespond,
  // ProposalsPage.tsx:301) — the row itself can render before that fetch settles, so wait on the
  // title specifically rather than just the row's visibility, or the click can land on a
  // genuinely disabled button while the SENT status is still propagating client-side.
  const acceptButton = proposalRow.getByTitle("Accepter");
  await expect(acceptButton).toBeVisible({ timeout: 15000 });
  await acceptButton.click();
  await expect(page.getByText(/sera créé/)).toBeVisible();
  await page.getByRole("button", { name: /Accepter et lancer/i }).click();
  await expect(page).toHaveURL(/\/app\/projects\/[a-f0-9-]+/);

  const projectId = page.url().match(/\/app\/projects\/([a-f0-9-]+)/)![1];
  const projectRes = await request.get(`${API_BASE}/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const project = (await projectRes.json()).data;
  expect(project.clientId, "the cascaded project must belong to the converted client").toBe(client.id);

  // Step 3: project -> task. The project detail page's own "Nouvelle tâche" button only renders
  // once the project already has at least one task (ProjectDetailPage.tsx) — a fresh project has
  // none yet, so this journey goes straight to the Tasks page instead, the same destination that
  // button itself navigates to.
  const taskTitle = `E2E Journey Task ${uniq}`;
  await page.goto(`/app/tasks?projectId=${project.id}&openCreate=true`);
  await page.getByLabel(/[Tt]itre/i).fill(taskTitle);
  await page.getByRole("button", { name: /^[Cc]réer/i }).click();
  // The create dialog itself closing is the real UI signal here — the AG Grid list this journey
  // lands on afterward is sorted independently of creation order and isn't guaranteed to show a
  // freshly created row without an explicit re-search, which the API check right below already
  // covers as the real source of truth.
  await expect(page.getByRole("dialog").filter({ hasText: /[Tt]âche/ })).toHaveCount(0);

  const tasksRes = await request.get(`${API_BASE}/tasks?projectId=${project.id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const tasksBody = await tasksRes.json();
  const task = tasksBody.data.find((t: { title: string }) => t.title === taskTitle);
  expect(task, "the task creation must have produced a real Task row on the project").toBeTruthy();

  // Step 4: client -> invoice, via the real Invoices UI.
  const invoiceTitle = `E2E Journey Invoice ${uniq}`;
  await page.getByRole("link", { name: "Factures" }).click();
  await page.getByRole("button", { name: /[Cc]réer une facture/i }).click();
  await page.getByLabel(/[Cc]lient/i).click();
  await page.getByRole("option", { name: leadName }).click();
  await page.getByLabel(/[Tt]itre/i).fill(invoiceTitle);
  await page.getByLabel(/[Mm]ontant/i).fill("1000");
  await page.getByRole("button", { name: /^[Cc]réer/i }).click();
  // Same doctrine as the task creation above: the dialog closing is the real UI signal, the API
  // check right below is the source of truth for whether the row itself was actually created.
  await expect(page.getByRole("dialog").filter({ hasText: /[Ff]acture/ })).toHaveCount(0);

  const invoicesRes = await request.get(`${API_BASE}/invoices?search=${encodeURIComponent(invoiceTitle)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const invoicesBody = await invoicesRes.json();
  const invoice = invoicesBody.data.find((i: { title: string }) => i.title === invoiceTitle);
  expect(invoice, "the invoice creation must have produced a real Invoice row for this client").toBeTruthy();
  expect(invoice.clientId).toBe(client.id);
});
