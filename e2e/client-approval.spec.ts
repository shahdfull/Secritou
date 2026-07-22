import { type APIRequestContext, type APIResponse } from "@playwright/test";
import { test, expect } from "./fixtures";

// Fails fast with the real server error instead of letting a bad setup step surface later as an
// opaque UI timeout (a POST/PUT that 4xx/5xxs still resolves — Playwright's `request` doesn't
// throw on non-2xx — so an unchecked call here would silently leave the fixture data in the wrong
// state and the eventual failure would look unrelated to its actual cause).
async function expectOk(res: APIResponse, step: string) {
  if (!res.ok()) {
    throw new Error(`${step} failed: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}

// RG-013 (client-only final approval) is already covered server-side (real transaction,
// concurrency guard against a double-click race) and the composed UI is covered by unit-level
// component tests elsewhere — this proves the one thing neither can: a real client user, in a
// real browser, sees the "Confirmer et clôturer" action on a project actually in REVIEW with its
// deposit paid, and clicking it really flips the project's real status server-side.
//
// Builds its own project end-to-end via the API (propose -> accept cascade -> pay deposit ->
// mark the only task DONE -> move to REVIEW) rather than depending on a specific seeded project
// staying un-approved across repeated runs — clientApprove is a one-way transition, so reusing a
// seeded row would only pass once per fresh database.

const API_BASE = "http://localhost:5000/api/v1";

async function login(request: APIRequestContext, email: string, password: string) {
  const res = await request.post(`${API_BASE}/auth/login`, { data: { email, password } });
  const body = await res.json();
  return body.data.tokens.accessToken as string;
}

test("a client sees the closing action on a project ready for review, and approving it really closes the project (RG-013)", async ({ page, request }) => {
  const adminToken = await login(request, "admin@secritou.tn", "admin123");
  const adminAuth = { Authorization: `Bearer ${adminToken}` };

  // Use the seeded CLIENT user client3@example.tn (Géant Tunisia), whose portal is already
  // activated by an earlier seeded deposit payment (server/prisma/seed.ts) — this test only
  // needs a fresh PROJECT for that same client, not a fresh client.
  const clientsRes = await request.get(`${API_BASE}/clients?search=Géant&pageSize=1`, { headers: adminAuth });
  const geantClient = (await clientsRes.json()).data[0];

  const proposalTitle = `E2E approval proposal ${Date.now()}`;
  const createRes = await request.post(`${API_BASE}/proposals`, {
    headers: adminAuth,
    data: { title: proposalTitle, amount: 1000, currency: "TND", clientId: geantClient.id },
  });
  const proposal = (await expectOk(createRes, "create proposal")).data;
  await expectOk(await request.post(`${API_BASE}/proposals/${proposal.id}/send`, { headers: adminAuth }), "send proposal");

  const acceptRes = await request.post(`${API_BASE}/proposals/${proposal.id}/accept`, { headers: adminAuth });
  const { meta } = await expectOk(acceptRes, "accept proposal");
  const projectId = meta.projectId as string;
  const depositInvoiceId = meta.invoiceId as string;

  // Pay the deposit invoice IN FULL (its real TTC amount — a 30% slice of the proposal's HT
  // amount, then VATed, not the proposal's own amount) — this is also what activates the client
  // portal (RG-018), required by client-approve's requireActivatedPortal guard.
  // A DRAFT invoice rejects payment (addPayment only accepts SENT/PARTIAL/OVERDUE) — send first.
  await expectOk(await request.post(`${API_BASE}/invoices/${depositInvoiceId}/send`, { headers: adminAuth }), "send deposit invoice");
  // The API serializes Prisma Decimal fields as strings, not JSON numbers — the payment
  // validator rejects a string `amount` outright (422 "Expected number, received string").
  const depositInvoiceRes = await request.get(`${API_BASE}/invoices/${depositInvoiceId}`, { headers: adminAuth });
  const depositInvoiceAmount = Number((await expectOk(depositInvoiceRes, "get deposit invoice")).data.amount);
  const paymentRes = await request.post(`${API_BASE}/invoices/${depositInvoiceId}/payments`, {
    headers: adminAuth,
    data: { amount: depositInvoiceAmount, method: "Virement bancaire" },
  });
  await expectOk(paymentRes, "pay deposit invoice");
  const invoiceAfterPayment = await request.get(`${API_BASE}/invoices/${depositInvoiceId}`, { headers: adminAuth });
  const invoiceStatus = (await expectOk(invoiceAfterPayment, "get deposit invoice after payment")).data.status;
  expect(invoiceStatus).toBe("PAID");

  // Move the project to REVIEW with no open tasks, so clientApprove's guards all pass.
  // PROJECT_STATUS_VALID_TRANSITIONS (shared/src/schemas/project.schema.ts) only allows
  // PLANNING -> IN_PROGRESS -> REVIEW, not a direct PLANNING -> REVIEW jump.
  await expectOk(
    await request.put(`${API_BASE}/projects/${projectId}`, { headers: adminAuth, data: { status: "IN_PROGRESS" } }),
    "move project to IN_PROGRESS"
  );
  const reviewRes = await request.put(`${API_BASE}/projects/${projectId}`, {
    headers: adminAuth,
    data: { status: "REVIEW" },
  });
  const projectInReview = (await expectOk(reviewRes, "move project to REVIEW")).data;
  expect(projectInReview.status).toBe("REVIEW");

  await page.goto("/login");
  await page.locator("#login-email").fill("client3@example.tn");
  await page.locator("#login-password").fill("client123");
  await page.getByRole("button", { name: /Se connecter/i }).click();
  await expect(page).toHaveURL(/\/client/);

  // Navigate via a real in-app SPA link, not page.goto: the access token lives in memory
  // (Zustand store, not localStorage), so a full page reload would lose it and race a
  // cookie-based refresh against this page's first data fetch (see proposal-cascade.spec.ts,
  // where the same page.goto pattern was the root cause of a flaky 401).
  await page.getByRole("link", { name: "Projets" }).click();
  const card = page.locator(".rounded-3xl", { hasText: proposalTitle });
  await expect(card).toBeVisible({ timeout: 15_000 });
  const approveButton = card.getByRole("button", { name: "Approuver et clôturer le projet" });
  await approveButton.scrollIntoViewIfNeeded();
  await approveButton.click();

  await page.getByLabel(/je confirme|validation finale/i).check();
  // The confirm dialog's own static copy already contains "clôturé"/"clôturer" (title, warning
  // banner, button label) — asserting on that text alone can match the dialog itself instead of
  // waiting for the post-mutation success toast, letting the test race ahead of the real API call.
  // Wait for the dialog to actually close (mutation's onSuccess calls onClose()) before checking
  // the toast, so the assertion can only be satisfied once the mutation has truly resolved.
  await page.getByRole("button", { name: "Confirmer et clôturer" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/clôturé/)).toBeVisible();

  // Confirm the real server-side state actually changed, not just a client-side optimistic toast.
  const projectAfter = await request.get(`${API_BASE}/projects/${projectId}`, { headers: adminAuth });
  const projectData = (await projectAfter.json()).data;
  expect(projectData.status).toBe("COMPLETED");
  expect(projectData.clientApprovedAt).toBeTruthy();
});
