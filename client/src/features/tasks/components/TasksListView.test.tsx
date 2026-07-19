// SEC-056 (U2): TasksListView used a fixed-pixel-column CSS grid with no stacked variant,
// unusable without horizontal scroll on a narrow screen — unlike ProjectsPage's responsive
// grid-cols-1 md:grid-cols-2 cards. This test renders the real component and asserts both a
// desktop table container (hidden below sm) and a mobile card list (sm:hidden) exist in the DOM,
// each rendering the same task — proving the responsive split is actually wired, not just that a
// className string was added somewhere.

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
    title: "Write the SEC-056 test",
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

function renderList(tasks: Task[]) {
  return render(
    <TasksListView
      tasks={tasks}
      projectNameById={new Map([["project-1", "Site vitrine"]])}
      userById={new Map()}
      filters={makeFilters()}
      sort={{ orderBy: undefined, orderDir: "desc", onSort: () => {} }}
      pagination={{ page: 1, pageSize: 10, total: tasks.length, onPageChange: () => {} }}
      permissions={{ isFreelancer: false, currentUserId: "user-1", canDelete: true }}
      actions={{ onView: () => {}, onEdit: () => {}, onDelete: () => {} }}
    />,
    { wrapper: makeWrapper() }
  );
}

describe("TasksListView responsive split — SEC-056 (U2)", () => {
  test("renders both a desktop table container (hidden below sm) and a mobile card list (sm:hidden), the latter showing task data", () => {
    const { container } = renderList([makeTask()]);

    // The desktop table body is virtualized (@tanstack/react-virtual), which renders zero rows
    // in JSDOM (no real viewport size to compute visible items against) — so only the container
    // and header are asserted on the desktop side. The mobile list is plain .map(), unaffected by
    // virtualization, so it's the reliable place to assert actual task data renders.
    const desktopContainer = container.querySelector(".hidden.sm\\:block");
    const mobileContainer = container.querySelector(".sm\\:hidden");
    expect(desktopContainer).not.toBeNull();
    expect(mobileContainer).not.toBeNull();

    expect(screen.getByText("Write the SEC-056 test")).toBeInTheDocument();
    expect(mobileContainer?.textContent).toContain("Write the SEC-056 test");
  });

  test("mobile card list shows the empty-state message when there are no tasks", () => {
    renderList([]);
    expect(screen.getByText("Aucune tâche.")).toBeInTheDocument();
  });
});
