// SEC-055 (F5): ProjectDetailPage's "+ Nouvelle tâche" button navigates to
// /app/tasks?projectId=<id>&openCreate=true, and TasksPage consumes that to auto-open the create
// dialog. This test calls the real useTaskActions().openCreateDialogForProject and asserts:
// 1. It opens the create dialog (createDialogOpen becomes true).
// 2. The create form's projectId field is pre-filled with the given project — not left empty for
//    the user to pick again from the selector already known to truncate past 100 (SEC-053).

import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/api/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
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
