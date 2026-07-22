import { type APIRequestContext } from "@playwright/test";
import { test, expect } from "./fixtures";

// The proposal->project cascade (RG-010) is already covered server-side (real transaction,
// concurrency) and client-side at the component level (mocked hooks) — this is the one layer
// neither can reach: a real browser driving the real ProposalsPage against a real running
// server, proving the full round trip (click Accept -> real network call -> real navigation to
// the newly created project's real URL) actually works end-to-end.
//
// Seeded proposals are mutated by earlier runs (accepting one flips its status permanently), so
// this creates its own fresh DRAFT->SENT proposal via the API in a per-test setup, rather than
// depending on a specific seeded row staying SENT across repeated runs.

const API_BASE = "http://localhost:5000/api/v1";

async function loginAsAdmin(request: APIRequestContext) {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { email: "admin@secritou.tn", password: "admin123" },
  });
  const body = await res.json();
  return body.data.tokens.accessToken as string;
}

async function createSentProposal(request: APIRequestContext, accessToken: string) {
  const clientsRes = await request.get(`${API_BASE}/clients?pageSize=1`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const clientsBody = await clientsRes.json();
  const clientId = clientsBody.data[0].id as string;

  const createRes = await request.post(`${API_BASE}/proposals`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: {
      title: `E2E cascade proposal ${Date.now()}`,
      amount: 5000,
      currency: "TND",
      clientId,
    },
  });
  const created = (await createRes.json()).data;

  await request.post(`${API_BASE}/proposals/${created.id}/send`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return created.title as string;
}

test("accepting a SENT proposal navigates to the newly created project (RG-010, real browser + real server)", async ({ page, request }) => {
  const accessToken = await loginAsAdmin(request);
  const proposalTitle = await createSentProposal(request, accessToken);

  await page.goto("/login");
  await page.locator("#login-email").fill("admin@secritou.tn");
  await page.locator("#login-password").fill("admin123");
  await page.getByRole("button", { name: /Se connecter/i }).click();
  await expect(page).toHaveURL(/\/app$/);

  // Navigate via a real in-app SPA link, not page.goto: the access token lives in memory
  // (Zustand store, not localStorage — see useBootstrapSession), so a full page reload would
  // lose it and race a cookie-based refresh against this page's first data fetch.
  await page.getByRole("link", { name: "Propositions" }).click();
  // Search rather than scanning the default (paginated, oldest-first) list — repeated e2e runs
  // accumulate proposals over time, and a freshly-created one is not guaranteed to land on the
  // first page. The search box filters server-side (useListParams -> useProposals({ search })).
  //
  // The search input is fully controlled by the URL's search param (useListParams ->
  // useSearchParams), and its onChange fires a router update on every keystroke. Playwright's
  // .fill() sets the value via CDP in one shot, but React's controlled re-render can still land
  // mid-fill and truncate/corrupt the committed value (observed: "1784730809745" -> "17847308097").
  // Asserting the input's own committed value before relying on it elsewhere avoids that race.
  const searchBox = page.getByPlaceholder("Rechercher des propositions...");
  await searchBox.fill(proposalTitle);
  await expect(searchBox).toHaveValue(proposalTitle);
  const row = page.locator("tr", { hasText: proposalTitle });
  await expect(row).toBeVisible({ timeout: 15_000 });

  await row.getByTitle("Accepter").click();
  await expect(page.getByText(/sera créé/)).toBeVisible();
  await page.getByRole("button", { name: /Accepter et lancer/i }).click();

  // The cascade creates a real Project and navigates to its real detail page — proving the
  // full round trip, not just that a success toast appeared. The project detail page repeats the
  // title both in a heading and in a related-activity list, so scope to the heading specifically.
  await expect(page).toHaveURL(/\/app\/projects\/[a-f0-9-]+/);
  await expect(page.getByRole("heading", { name: proposalTitle })).toBeVisible();
});
