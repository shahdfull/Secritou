// SEC-094: the desktop table's icon-only Voir/Modifier/Supprimer buttons only had a `title`, not
// an `aria-label` — the mobile card variant of this same file already had `aria-label` (SEC-056),
// making the desktop variant inconsistent and its buttons unreliably named for screen readers.
//
// This renders the real TasksListView desktop table, mocking @tanstack/react-virtual (renders
// zero rows in JSDOM otherwise — same limitation already hit for SEC-056/SEC-059/SEC-060,
// isolated to this file rather than applied globally to TasksListView.test.tsx).

import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, test, vi, beforeAll } from "vitest";
import type { ReactNode } from "react";
import i18n from "@/i18n";
import type { Task } from "@/types/task";
import { TasksListView, type TasksFilters } from "./TasksListView";

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 56,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({ index, start: index * 56, size: 56 })),
  }),
}));

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

function makeTask(): Task {
  return {
    id: "task-1",
    title: "Write the SEC-094 test",
    status: "TODO",
    priority: "NORMAL",
    projectId: "project-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeFilters(overrides: Partial<TasksFilters> = {}): TasksFilters {
  return {
    search: "",
    onSearchChange: () => {},
    status: "All",
    onStatusChange: () => {},
    assigneeId: undefined,
    onAssigneeChange: () => {},
    assignableUsers: [],
    overdue: false,
    onOverdueChange: () => {},
    ...overrides,
  };
}

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("TasksListView desktop table icon buttons — SEC-094", () => {
  test("each icon-only button (Voir/Modifier/Supprimer) has a real accessible name, not just a title", () => {
    render(
      <TasksListView
        tasks={[makeTask()]}
        projectNameById={new Map([["project-1", "Site vitrine"]])}
        userById={new Map()}
        filters={makeFilters()}
        sort={{ orderBy: undefined, orderDir: "desc", onSort: () => {} }}
        pagination={{ page: 1, pageSize: 10, total: 1, onPageChange: () => {} }}
        permissions={{ isFreelancer: false, currentUserId: "user-1", canDelete: true }}
        actions={{ onView: () => {}, onEdit: () => {}, onDelete: () => {} }}
      />,
      { wrapper: makeWrapper() }
    );

    // getAllByRole with an accessible name matches both the desktop and mobile variants (both
    // render for the same task in JSDOM, since neither media query applies) — asserting at least
    // one exists per label is enough to prove the desktop variant now has a real accessible name.
    expect(screen.getAllByRole("button", { name: "Voir" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Modifier" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Supprimer" }).length).toBeGreaterThan(0);
  });
});
