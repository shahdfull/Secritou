import { test, expect } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

// SEC-098: NotificationBell's unread-count badge and alert icons measured under 4.5:1 (WCAG
// 1.4.3) — the first SEC-096 audit missed this because the badge only renders when unreadCount >
// 0, and its animate-pulse (opacity 1 -> 0.5 -> 1) drops the pulse-trough ratio well below 4.5:1
// even with conforming colors at full opacity. Forces the exact state (a real TASK_OVERDUE
// notification, unread) via a mocked API response rather than waiting for it to occur by chance —
// the same angle mot documented in the anomaly.
test("notification bell badge and alert icon meet 4.5:1 contrast with a real critical unread notification forced", async ({ page }) => {
  await page.route("**/api/v1/notifications", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: "test-notif-1",
            userId: "test-user",
            title: "Tâche en retard",
            message: "Une tâche a dépassé son échéance",
            type: "TASK_OVERDUE",
            entityId: null,
            link: null,
            read: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      }),
    });
  });

  await page.goto("/login");
  await page.locator("#login-email").fill("admin@secritou.tn");
  await page.locator("#login-password").fill("admin123");
  await page.getByRole("button", { name: /Se connecter/i }).click();
  await page.waitForURL(/\/app$/);

  const bellButton = page.getByRole("button", { name: /notification/i });
  await expect(bellButton).toBeVisible({ timeout: 10000 });
  await expect(bellButton.locator("text=1")).toBeVisible();

  // Scope the scan to the bell button only — this test's contract is the badge/icon fix, not a
  // full-page accessibility audit (the dashboard behind it may have its own unrelated violations,
  // e.g. DashboardPage.tsx:82's separate text-red-500 trend indicator, tracked separately).
  //
  // animate-alert-pulse (SEC-098 fix) pulses box-shadow/scale, not opacity — the text/bg colors
  // of the badge never change during the animation, so a single scan at any point in the cycle is
  // representative of every point in the cycle (unlike the old animate-pulse, where the ratio
  // depended on capture timing). Scan twice, ~1s apart (roughly a quarter of the 2s cycle), to
  // confirm the ratio really is constant rather than assuming it from the CSS alone.
  const scan1 = await new AxeBuilder({ page }).include('button[aria-label*="otification"], button[aria-label*="Notification"]').withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(scan1.violations.filter((v) => v.id === "color-contrast"), JSON.stringify(scan1.violations)).toHaveLength(0);

  await page.waitForTimeout(1000);
  const scan2 = await new AxeBuilder({ page }).include('button[aria-label*="otification"], button[aria-label*="Notification"]').withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(scan2.violations.filter((v) => v.id === "color-contrast"), JSON.stringify(scan2.violations)).toHaveLength(0);

  // Open the dropdown to also cover the alert icon (XCircle/AlertTriangle, text-red-600 after
  // the fix) rendered inside the notification list, not just the closed badge.
  await bellButton.click();
  await page.waitForTimeout(300);
  const scanOpen = await new AxeBuilder({ page }).include('[data-radix-popper-content-wrapper], [role="dialog"]').withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(scanOpen.violations.filter((v) => v.id === "color-contrast"), JSON.stringify(scanOpen.violations)).toHaveLength(0);
});
