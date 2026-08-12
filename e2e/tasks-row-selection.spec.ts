import { test, expect } from "./fixtures";

// SEC-108: TasksListView.tsx is the only AG Grid table using rowSelection (bulk status
// change/delete for ADMIN/MANAGER, SEC-060) — the one AG Grid module dependency in this project
// with real functional consequence beyond rendering. Its checkboxes and selection state depend on
// RowSelectionModule being registered (client/src/lib/agGridModules.ts). A missing-module
// regression there fails completely silently: no console error without enableDevValidations(),
// the grid renders normally, only the checkboxes are absent (confirmed by direct investigation
// before this test existed). This locks the real behavior end-to-end so that specific regression
// can never land unnoticed again.
test("ADMIN sees working row-selection checkboxes on the tasks grid and can select a row", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#login-email").fill("admin@secritou.tn");
  await page.locator("#login-password").fill("admin123");
  await page.getByRole("button", { name: /Se connecter/i }).click();
  await expect(page).toHaveURL(/\/app$/);

  await page.goto("/app/tasks");

  const grid = page.locator(".ag-root");
  await expect(grid).toBeVisible({ timeout: 10000 });

  // Header select-all checkbox — only rendered when RowSelectionModule is registered and
  // rowSelection.headerCheckbox is set (TasksListView.tsx, canBulkAct branch for ADMIN/MANAGER).
  const headerCheckbox = page.locator(".ag-header-select-all .ag-checkbox-input");
  await expect(headerCheckbox).toBeAttached({ timeout: 10000 });

  // A real row checkbox must exist and be clickable — not just present in the DOM.
  const firstRowCheckbox = page.locator(".ag-selection-checkbox .ag-checkbox-input").first();
  await expect(firstRowCheckbox).toBeAttached();
  await firstRowCheckbox.click({ force: true });

  // Selecting a row must surface the bulk-action bar (real onSelectionChanged -> selectedIds
  // wiring, not just a visual checkbox with no behavior behind it).
  await expect(page.getByText(/\d+ tâche\(s\) sélectionnée\(s\)/)).toBeVisible({ timeout: 5000 });
});
