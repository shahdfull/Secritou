// SEC-060 (actions en masse, item 3 du constat P1 rapport Product Owner) : aucune sélection
// multiple ni action groupée n'existait sur la liste des tâches — recherche exhaustive de "bulk"
// dans client/src/features/tasks/, aucune occurrence.
//
// This test renders the real TasksListView, mocking only apiClient (not the bulk mutation logic
// in useTasks.ts). AG Grid (migration follow-up to SEC-056) virtualizes rows and renders none in
// JSDOM (no real viewport to compute visible rows against) — selection is driven via
// gridApi.selectAll() (exposed through the test-only onGridApiReady prop) instead of clicking a
// row checkbox. Each test uses exactly one task, so "select all" and "select this task" are
// equivalent here; this still exercises the real selection→bulk-bar→mutation pipeline, not a
// reimplementation of it.

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { describe, expect, test, vi, beforeAll, beforeEach } from "vitest";
import type { ReactNode } from "react";
import type { GridApi } from "ag-grid-community";
import i18n from "@/i18n";
import type { Task } from "@/types/task";
import { TasksListView, type TasksFilters, type TaskGridRow } from "./TasksListView";

const postMock = vi.fn();
vi.mock("@/api/axios", () => ({
  default: { get: vi.fn(), post: (...args: unknown[]) => postMock(...args), put: vi.fn(), delete: vi.fn() },
}));

// @radix-ui/react-select relies on pointer capture APIs and scrollIntoView, neither implemented
// by JSDOM — polyfilled here so opening the real Select via a real click doesn't throw.
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
Element.prototype.setPointerCapture = Element.prototype.setPointerCapture ?? (() => {});
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

beforeEach(() => {
  postMock.mockReset();
  postMock.mockResolvedValue({ data: { data: [{ id: "task-1", success: true }] } });
});

function makeTask(): Task {
  return {
    id: "task-1",
    title: "Bulk actions task",
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

function renderList(tasks: Task[], overrides: Partial<{ isFreelancer: boolean; canDelete: boolean }> = {}) {
  let gridApi: GridApi<TaskGridRow> | undefined;
  const result = render(
    <TasksListView
      tasks={tasks}
      projectNameById={new Map([["project-1", "Site vitrine"]])}
      userById={new Map()}
      filters={makeFilters()}
      sort={{ orderBy: undefined, orderDir: "desc", onSort: () => {} }}
      pagination={{ page: 1, pageSize: 10, total: tasks.length, onPageChange: () => {} }}
      permissions={{ isFreelancer: overrides.isFreelancer ?? false, currentUserId: "user-1", canDelete: overrides.canDelete ?? true }}
      actions={{ onView: () => {}, onEdit: () => {}, onDelete: () => {} }}
      onGridApiReady={(api) => { gridApi = api; }}
    />,
    { wrapper: makeWrapper() }
  );
  return { ...result, getGridApi: () => gridApi };
}

// Drives selection through AG Grid's own model (selectAll operates on row data regardless of
// what's actually painted to the DOM) rather than a simulated click — the real seam a JSDOM test
// has available since AG Grid virtualizes rows out of existence without a real viewport.
async function selectAllTasks(getGridApi: () => GridApi<TaskGridRow> | undefined) {
  await waitFor(() => expect(getGridApi()).toBeDefined());
  await act(async () => {
    getGridApi()!.selectAll();
  });
  // AG Grid's selectionChanged fires asynchronously relative to the act() flush above — wait for
  // the bulk bar's own count text rather than assuming selectAll() has already propagated to
  // React state by the time this returns (this was the source of test-order-dependent flakiness).
  await waitFor(() => screen.getByText(/\d+ tâche\(s\) sélectionnée\(s\)/));
}

describe("TasksListView bulk actions — SEC-060", () => {
  test("a FREELANCER never gets row selection (bulk routes are ADMIN/MANAGER only server-side)", async () => {
    const { getGridApi } = renderList([makeTask()], { isFreelancer: true });
    // rowSelection is undefined when isFreelancer — selectAll() has nothing to select against,
    // and the bulk bar (gated on canBulkAct === !isFreelancer) must never appear regardless. Not
    // using the selectAllTasks helper here: it waits for the bulk bar text, which must never show.
    await waitFor(() => expect(getGridApi()).toBeDefined());
    await act(async () => {
      getGridApi()!.selectAll();
    });
    expect(screen.queryByText(/tâche\(s\) sélectionnée\(s\)/)).not.toBeInTheDocument();
  });

  test("selecting a task shows the bulk action bar with the count", async () => {
    const { getGridApi } = renderList([makeTask()]);

    await selectAllTasks(getGridApi);

    expect(screen.getByText("1 tâche(s) sélectionnée(s)")).toBeInTheDocument();
  });

  test("bulk status change calls the real POST /tasks/bulk/status with the selected task id", async () => {
    const user = userEvent.setup();
    const { getGridApi } = renderList([makeTask()]);

    await selectAllTasks(getGridApi);
    const statusTrigger = screen.getByText("Changer le statut...").closest('[role="combobox"]');
    expect(statusTrigger).not.toBeNull();
    await user.click(statusTrigger!);
    await user.click(await screen.findByRole("option", { name: "En cours" }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/tasks/bulk/status", { taskIds: ["task-1"], status: "IN_PROGRESS" });
    });
  });

  test("bulk delete requires confirmation before calling the real POST /tasks/bulk/delete", async () => {
    const user = userEvent.setup();
    const { getGridApi } = renderList([makeTask()]);

    await selectAllTasks(getGridApi);
    // Multiple "Supprimer" targets exist (per-row icon buttons + the bulk bar's text button) —
    // the bulk bar's is the only one with visible text content.
    const deleteButtons = screen.getAllByRole("button", { name: /Supprimer/ });
    const bulkBarDeleteButton = deleteButtons.find((btn) => btn.textContent === "Supprimer");
    expect(bulkBarDeleteButton).toBeDefined();
    await user.click(bulkBarDeleteButton!);
    // Confirmation dialog must appear before the request fires.
    expect(postMock).not.toHaveBeenCalled();

    const confirmButtons = screen.getAllByRole("button", { name: "Supprimer" });
    await user.click(confirmButtons[confirmButtons.length - 1]!);

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/tasks/bulk/delete", { taskIds: ["task-1"] });
    });
  });

  test("the bulk delete button is hidden when the viewer lacks delete permission", async () => {
    const { getGridApi } = renderList([makeTask()], { canDelete: false });

    await selectAllTasks(getGridApi);

    const deleteButtons = screen.queryAllByRole("button", { name: /Supprimer/ });
    expect(deleteButtons.find((btn) => btn.textContent === "Supprimer")).toBeUndefined();
  });

  test("clearing the selection hides the bulk action bar", async () => {
    const user = userEvent.setup();
    const { getGridApi } = renderList([makeTask()]);

    await selectAllTasks(getGridApi);
    expect(screen.getByText("1 tâche(s) sélectionnée(s)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Annuler la sélection/ }));
    expect(screen.queryByText("1 tâche(s) sélectionnée(s)")).not.toBeInTheDocument();
  });
});
