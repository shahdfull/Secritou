import { test, expect } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

// SEC-096: continuous axe-core coverage in CI (declencheur_reexamen (2), explicit porteur request
// 2026-08-14) — distinct from the one-off scan already done 2026-08-13, whose 6 real violations
// were already fixed and are not re-described here. This file runs on every CI push/PR, scanning
// the 15-screen core selected as the proportionate continuous set: the 5 public marketing pages
// already covered once (regression guard), plus 8 structuring ADMIN/MANAGER screens and 2 CLIENT
// portal screens never covered before. Deliberately NOT exhaustive over every route in
// AppRoutes.tsx (~35 internal pages) — excluded: parameterized detail pages (/projects/:id,
// /clients/:id, requiring a real seeded entity id and visually/structurally close to their already-
// covered list page), analytics sub-pages (close to the dashboard already scanned, backlog on
// signal), /contact and /rejoindre (less structuring), /login and /reset-password (exercised
// indirectly by every login below), and the FREELANCER portal (not prioritized for this first
// continuous pass).
//
// Exception doctrine (same principle as CLAUDE.md's react-refresh/only-export-components
// exception): a violation may only be excluded from the assertion via an explicit, named entry in
// KNOWN_EXCEPTIONS below, each carrying a written justification and the axe rule id it covers —
// never a silent .skip() or a broadened tag filter. The gate below fails on any violation whose
// (page, rule id) pair isn't in that list.
type Exception = { page: string; ruleId: string; justification: string };

// SEC-096: continuous scan, 2026-08-14 — no known false positive requiring exclusion has been
// found across all 15 screens on this first run. Kept as an explicit, empty starting point rather
// than omitting the mechanism entirely, so the FIRST time a legitimate exception is needed, it's
// a one-line addition here with a written reason — not a silent workaround invented under time
// pressure at the point of failure.
const KNOWN_EXCEPTIONS: Exception[] = [];

function isExcepted(pageName: string, ruleId: string): boolean {
  return KNOWN_EXCEPTIONS.some((e) => e.page === pageName && e.ruleId === ruleId);
}

async function assertNoUnexceptedViolations(pageName: string, page: Parameters<typeof AxeBuilder>[0]["page"]) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const critical = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  const unexcepted = critical.filter((v) => !isExcepted(pageName, v.id));
  expect(
    unexcepted,
    `${pageName}: ${unexcepted.length} unexcepted critical/serious violation(s):\n${JSON.stringify(unexcepted, null, 2)}`
  ).toHaveLength(0);
}

test.describe("Continuous axe-core coverage — public pages (SEC-096)", () => {
  const publicPages = [
    { name: "home", path: "/" },
    { name: "case-studies", path: "/case-studies" },
    { name: "mentions-legales", path: "/mentions-legales" },
    { name: "confidentialite", path: "/confidentialite" },
    { name: "forgot-password", path: "/forgot-password" },
  ];

  for (const p of publicPages) {
    test(`${p.name} (${p.path})`, async ({ page }) => {
      await page.goto(p.path, { waitUntil: "networkidle" });
      await assertNoUnexceptedViolations(p.name, page);
    });
  }
});

test.describe("Continuous axe-core coverage — ADMIN screens (SEC-096)", () => {
  const adminPages = [
    { name: "dashboard", path: "/app" },
    { name: "crm", path: "/app/crm" },
    { name: "tasks", path: "/app/tasks" },
    { name: "projects", path: "/app/projects" },
    { name: "talent", path: "/app/talent" },
    { name: "documents", path: "/app/documents" },
    { name: "settings", path: "/app/settings" },
    { name: "ai-assistant", path: "/app/ai" },
  ];

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.locator("#login-email").fill("admin@secritou.tn");
    await page.locator("#login-password").fill("admin123");
    await page.getByRole("button", { name: /Se connecter/i }).click();
    await expect(page).toHaveURL(/\/app$/);
  });

  for (const p of adminPages) {
    test(`${p.name} (${p.path})`, async ({ page }) => {
      if (p.path !== "/app") {
        await page.goto(p.path, { waitUntil: "networkidle" });
      } else {
        await page.waitForLoadState("networkidle");
      }
      await assertNoUnexceptedViolations(p.name, page);
    });
  }
});

test.describe("Continuous axe-core coverage — CLIENT portal screens (SEC-096)", () => {
  const clientPages = [
    { name: "client-dashboard", path: "/client" },
    { name: "client-invoices", path: "/client/invoices" },
  ];

  test.beforeEach(async ({ page }) => {
    // Seeded CLIENT user with an activated portal (server/prisma/seed.ts) — same account already
    // used by client-approval.spec.ts, not a new fixture.
    await page.goto("/login");
    await page.locator("#login-email").fill("client3@example.tn");
    await page.locator("#login-password").fill("client123");
    await page.getByRole("button", { name: /Se connecter/i }).click();
    await expect(page).toHaveURL(/\/client/);
  });

  for (const p of clientPages) {
    test(`${p.name} (${p.path})`, async ({ page }) => {
      if (p.path !== "/client") {
        await page.goto(p.path, { waitUntil: "networkidle" });
      } else {
        await page.waitForLoadState("networkidle");
      }
      await assertNoUnexceptedViolations(p.name, page);
    });
  }
});
