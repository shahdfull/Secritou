import { defineConfig, devices } from "@playwright/test";

// e2e tests hit a real running client (Vite PRODUCTION preview, not the dev server) talking to a
// real running server (Express) against the real dev Postgres/Redis — no mocks, unlike the
// vitest/node:test suites.
//
// Deliberately `build` + `preview`, not `dev`: the dev server runs under React.StrictMode
// (client/src/main.tsx), which double-invokes effects/renders in development only. That
// double-mount raced two concurrent instances of the same data-fetching component against each
// other during manual verification of this config — the second (stale) instance's empty response
// could commit after the first (correct) one, leaving the UI showing no data despite the network
// tab confirming the server answered correctly every time. Production preview does not use
// StrictMode, matching what real users (and CI) actually see.
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEB_SERVER === "true";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // scenarios share seeded accounts/data; parallel runs would race on state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  // SEC-212: CI runners observed with a slow first request (login) while Postgres/Redis
  // containers are still warming up under contention, tripping the 5s default before the
  // server even responds — default stays tight locally where the DB is already warm.
  expect: process.env.CI ? { timeout: 15_000 } : undefined,
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: skipWebServer
    ? undefined
    : [
        {
          command: "npm run dev --workspace=server",
          url: "http://localhost:5000/api/v1/health",
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
        {
          command: "npm run build --workspace=client && npm run preview --workspace=client",
          url: "http://localhost:5173",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ],
});
