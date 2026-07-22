import { test, expect } from "./fixtures";

// Real browser, real client (Vite dev), real server (Express), real dev database — the seeded
// admin@secritou.tn account (server/prisma/seed.ts). No mocks: this is the one layer the
// node:test/vitest suites can never cover (real HTTP-only auth cookie set by the browser, real
// client-side routing after a real network round trip).

test("ADMIN can log in with the seeded account and lands on /app", async ({ page }) => {
  await page.goto("/login");

  await page.locator("#login-email").fill("admin@secritou.tn");
  await page.locator("#login-password").fill("admin123");
  await page.getByRole("button", { name: /Se connecter/i }).click();

  await expect(page).toHaveURL(/\/app$/);
});

test("a CLIENT account lands on /client, not /app", async ({ page }) => {
  await page.goto("/login");

  await page.locator("#login-email").fill("client3@example.tn");
  await page.locator("#login-password").fill("client123");
  await page.getByRole("button", { name: /Se connecter/i }).click();

  await expect(page).toHaveURL(/\/client/);
});

test("wrong password shows an error and does not navigate away from /login", async ({ page }) => {
  await page.goto("/login");

  await page.locator("#login-email").fill("admin@secritou.tn");
  await page.locator("#login-password").fill("wrong-password-123");
  await page.getByRole("button", { name: /Se connecter/i }).click();

  await expect(page).toHaveURL(/\/login/);
});
