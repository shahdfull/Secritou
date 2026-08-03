import { test, expect } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

// SEC-099: GrowthBadge (DashboardPage.tsx) used text-red-500 for a negative growth value,
// measured under WCAG 1.4.3 (4.5:1) on both backgrounds it renders on — --card (HeroStat, 3.76:1)
// and --background (CompactStat, 3.65:1). Fixed to text-red-600 (matching the same fix already
// applied to NotificationBell.tsx's alert icons in SEC-098, for palette consistency). Forces a
// real negative growth value via a mocked API response rather than depending on real data having
// a negative month-over-month cash trend at test time.
test("dashboard GrowthBadge meets 4.5:1 with a real negative growth value forced", async ({ page }) => {
  await page.route("**/api/v1/analytics/executive*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          generatedAt: new Date().toISOString(),
          finance: {
            cashMTD: 10000, cashYTD: 50000, cashTotal: 100000,
            billedMTD: 12000, billedYTD: 60000, billedTotal: 120000,
            overdueAmount: 0, overdueCount: 0, pendingAmount: 0, pendingCount: 0,
            cashGrowthMoM: -12, cashGrowthYoY: -5, billedGrowthMoM: -8,
            overdueGrowthMoM: 0, pendingGrowthMoM: 0, cashByMonth: [],
          },
          forecast: { next30: 0, next60: 0, next90: 0, overdueCarryover: 0, proposalPipeline: 0, proposalWinRate: 0, confidenceScore: 80 },
          clients: { total: 5, active: 5, newMTD: 1, newGrowthMoM: -3, atRisk: 0, lost: 0, champions: 0, churnRate: 0, retentionRate: 100, topClients: [] },
          projects: { total: 5, planning: 1, inProgress: 2, review: 1, completed: 1, overdue: 0, stale: 0, blocked: 0, criticalCount: 0, watchCount: 0, completionRate: 20, avgDurationDays: 10, tasksDone: 5, tasksTotal: 10, tasksOverdue: 0 },
          risks: [],
          alerts: { overdueInvoices: 0, pendingApprovals: 0, criticalProjects: 0, hotLeads: 0 },
        },
      }),
    });
  });

  await page.goto("/login");
  await page.locator("#login-email").fill("admin@secritou.tn");
  await page.locator("#login-password").fill("admin123");
  await page.getByRole("button", { name: /Se connecter/i }).click();
  await page.waitForURL(/\/app$/);

  // -12% renders a real negative GrowthBadge on the "Trésorerie MTD" HeroStat.
  const badge = page.getByText("-12%", { exact: false }).first();
  await expect(badge).toBeVisible({ timeout: 10000 });

  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const contrastViolations = scan.violations.filter((v) => v.id === "color-contrast" && v.nodes.some((n) => n.html.includes("text-red")));
  expect(contrastViolations, JSON.stringify(contrastViolations)).toHaveLength(0);
});
