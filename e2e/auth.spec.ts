import { test, expect } from "@playwright/test";

test.describe("Auth flow", () => {
  test("admin login redirects to app dashboard", async ({ page, context }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill("admin@secritou.tn");
    await page.getByPlaceholder("Password").fill("admin123");
    await page.getByRole("button", { name: /log in|connexion|sign in/i }).click();

    await expect(page).toHaveURL(/\/app/, { timeout: 15_000 });

    const cookies = await context.cookies();
    const refreshCookie = cookies.find((c) => c.name === "secritou_refresh");
    expect(refreshCookie?.httpOnly).toBe(true);
  });

  test("client login redirects to client portal", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill("client1@example.tn");
    await page.getByPlaceholder("Password").fill("client123");
    await page.getByRole("button", { name: /log in|connexion|sign in/i }).click();

    await expect(page).toHaveURL(/\/client/, { timeout: 15_000 });
    await expect(page.getByText(/client/i)).toBeVisible();
  });

  test("refresh endpoint returns new access token via cookie", async ({ request }) => {
    const login = await request.post("http://localhost:5000/api/v1/auth/login", {
      data: { email: "admin@secritou.tn", password: "admin123" },
    });
    expect(login.ok()).toBeTruthy();

    const refresh = await request.post("http://localhost:5000/api/v1/auth/refresh", {
      data: {},
    });
    expect(refresh.ok()).toBeTruthy();
    const body = await refresh.json();
    expect(body.data.tokens.accessToken).toBeTruthy();
  });
});
