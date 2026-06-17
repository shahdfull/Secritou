import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run dev --workspace server",
      url: "http://localhost:5000/api/v1/health",
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/secritou?schema=public",
        JWT_ACCESS_SECRET: "test-access-secret-at-least-32-characters",
        JWT_REFRESH_SECRET: "test-refresh-secret-at-least-32-characters",
        CLIENT_ORIGIN: "http://localhost:5173",
        JOBS_ENABLED: "false",
        METRICS_ENABLED: "false",
      },
    },
    {
      command: "npm run dev --workspace client",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
