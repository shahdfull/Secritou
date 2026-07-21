// SEC-157: LeadsKanban.tsx's internal SortableLeadCard and KanbanColumn were plain functions,
// unlike TasksKanban.tsx's equivalent SortableTaskCard/KanbanColumn which are both wrapped in
// React.memo — up to 500 leads (LEADS_MAX_PAGE_SIZE) would re-render on every parent state change
// (drag activeId, refetch) with no memoization protecting them, unlike the tasks Kanban.
//
// SortableLeadCard/KanbanColumn are module-private (not exported), so this test verifies the fix
// the same way SEC-183's DEPOSIT_RATE test verifies its shared constant: by reading the real
// source file and confirming both are now wrapped in memo(), matching TasksKanban.tsx's own
// pattern exactly — React.memo's re-render-skipping behavior itself is a React guarantee, not
// something this codebase needs to re-prove per component.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

describe("LeadsKanban internal components are memoized like TasksKanban's (SEC-157)", () => {
  const content = readFileSync(join(__dirname, "LeadsKanban.tsx"), "utf-8");

  test("SortableLeadCard is wrapped in memo()", () => {
    expect(content).toMatch(/const SortableLeadCard = memo\(function SortableLeadCard/);
  });

  test("KanbanColumn is wrapped in memo()", () => {
    expect(content).toMatch(/const KanbanColumn = memo\(function KanbanColumn/);
  });
});
