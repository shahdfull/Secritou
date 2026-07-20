// SEC-055 (F5): ProjectDetailPage's "+ Nouvelle tâche" button navigates to
// /app/tasks?projectId=<id>&openCreate=true, and TasksPage consumes that to auto-open the create
// dialog. This test calls the real useTaskActions().openCreateDialogForProject and asserts:
// 1. It opens the create dialog (createDialogOpen becomes true).
// 2. The create form's projectId field is pre-filled with the given project — not left empty for
//    the user to pick again from the selector already known to truncate past 100 (SEC-053).

import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";
import type { ReactNode } from "react";

const postMock = vi.fn().mockResolvedValue({ data: { data: { id: "task-1" } } });
const putMock = vi.fn().mockResolvedValue({ data: { data: { id: "task-1" } } });
vi.mock("@/api/axios", () => ({
  default: { get: vi.fn(), post: (...args: unknown[]) => postMock(...args), put: (...args: unknown[]) => putMock(...args), patch: vi.fn(), delete: vi.fn() },
}));

const { useTaskActions } = await import("./useTaskActions");

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useTaskActions.openCreateDialogForProject — SEC-055 (F5)", () => {
  test("opens the create dialog with the form's projectId pre-filled", () => {
    const { result } = renderHook(() => useTaskActions(), { wrapper: makeWrapper() });

    expect(result.current.createDialogOpen).toBe(false);

    act(() => {
      result.current.openCreateDialogForProject("project-42");
    });

    expect(result.current.createDialogOpen).toBe(true);
    expect(result.current.createForm.getValues("projectId")).toBe("project-42");
  });
});

describe("useTaskActions.runCreate/runUpdate strip empty dates — SEC-079", () => {
  test("runCreate sends startDate/dueDate as undefined, not empty strings, when the form defaults them to \"\"", async () => {
    const { result } = renderHook(() => useTaskActions(), { wrapper: makeWrapper() });

    act(() => {
      result.current.handleCreate(result.current.createForm.getValues());
    });

    await waitFor(() => expect(postMock).toHaveBeenCalled());
    const [, body] = postMock.mock.calls[0]!;
    expect((body as Record<string, unknown>).startDate).toBeUndefined();
    expect((body as Record<string, unknown>).dueDate).toBeUndefined();
  });

  test("runUpdate sends startDate/dueDate as undefined when the edit form holds empty strings", async () => {
    const { result } = renderHook(() => useTaskActions(), { wrapper: makeWrapper() });

    act(() => {
      result.current.handleEditTask({
        id: "task-1",
        title: "No dates",
        status: "TODO",
        priority: "NORMAL",
        projectId: "project-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
    });

    act(() => {
      result.current.handleUpdate(result.current.editForm.getValues());
    });

    await waitFor(() => expect(putMock).toHaveBeenCalled());
    const [, body] = putMock.mock.calls[0]!;
    expect((body as Record<string, unknown>).startDate).toBeUndefined();
    expect((body as Record<string, unknown>).dueDate).toBeUndefined();
  });
});
