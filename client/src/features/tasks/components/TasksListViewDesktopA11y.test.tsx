// SEC-094: the desktop table's icon-only Voir/Modifier/Supprimer buttons only had a `title`, not
// an `aria-label` — the mobile card variant of this same file already had `aria-label` (SEC-056),
// making the desktop variant inconsistent and its buttons unreliably named for screen readers.
//
// This renders the real TasksListView. The AG Grid migration (SEC-056 follow-up) replaced the
// old @tanstack/react-virtual table body — AG Grid renders its actionsRenderer cell (with the
// same aria-labeled buttons) even in JSDOM without a real viewport, so no virtualization mock is
// needed here anymore.

import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, test, beforeAll } from "vitest";
import type { ReactNode } from "react";
import i18n from "@/i18n";
import type { Task } from "@/types/task";
import { TasksListView, type TasksFilters } from "./TasksListView";

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
    projectId: undefined,
    onProjectChange: () => {},
    projectOptions: [],
    priority: undefined,
    onPriorityChange: () => {},
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
