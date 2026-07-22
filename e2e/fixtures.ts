import { test as base } from "@playwright/test";

// The app's i18n detector (client/src/i18n/index.ts) checks localStorage["lang"] before falling
// back to navigator.language — every spec here matches French strings (the project's
// fallbackLng and default locale per CLAUDE.md), so force it explicitly rather than relying on
// browser locale settings, which vary by environment (Chromium's default is en-US in CI).
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("lang", "fr");
    });
    await use(page);
  },
});

export { expect } from "@playwright/test";
