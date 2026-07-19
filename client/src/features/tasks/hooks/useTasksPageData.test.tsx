// SEC-052: the "Voir toutes les tâches" link on a project's detail page navigates to
// /app/tasks?projectId=<id>, but TasksPage.tsx never read that query param — the user landed on
// the full, unfiltered company-wide task list instead. useTasks()/tasksApi.getAll() already
// supported a projectId argument end to end (server included); useTasksPageData just never
// received it.
//
// This test renders the real useTasksPageData hook (via renderHook) with a mocked apiClient.get,
// and asserts that passing a projectId results in the real GET /tasks request actually carrying
// `projectId` as a query param — proving the fix reaches all the way to the HTTP call, not just
// that a prop was threaded through.

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, test, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";

const getMock = vi.fn().mockResolvedValue({ data: { data: [], total: 0, page: 1, pageSize: 10 } });
vi.mock("@/api/axios", () => ({
  default: { get: (...args: unknown[]) => getMock(...args) },
}));

const { useTasksPageData } = await import("./useTasksPageData");

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useTasksPageData — SEC-052 projectId propagation", () => {
  beforeEach(() => {
    getMock.mockClear();
  });

  test("passes projectId through to the real GET /tasks request", async () => {
    renderHook(() => useTasksPageData({ page: 1, pageSize: 10 }, null, "project-42"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      const tasksCall = getMock.mock.calls.find(([url]) => url === "/tasks");
      expect(tasksCall).toBeDefined();
      expect(tasksCall?.[1]?.params?.projectId).toBe("project-42");
    });
  });

  test("omits projectId entirely when none is given (unfiltered list)", async () => {
    renderHook(() => useTasksPageData({ page: 1, pageSize: 10 }, null), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      const tasksCall = getMock.mock.calls.find(([url]) => url === "/tasks");
      expect(tasksCall).toBeDefined();
      expect(tasksCall?.[1]?.params?.projectId).toBeUndefined();
    });
  });
});

describe("useTasksPageData — SEC-053 projectsTotal exposure", () => {
  beforeEach(() => {
    getMock.mockClear();
  });

  test("exposes the real project total from the API response, not just the loaded page's length", async () => {
    getMock.mockImplementation((url: string) => {
      if (url === "/projects") {
        return Promise.resolve({ data: { data: [], total: 137, page: 1, pageSize: 100 } });
      }
      return Promise.resolve({ data: { data: [], total: 0, page: 1, pageSize: 10 } });
    });

    const { result } = renderHook(() => useTasksPageData({ page: 1, pageSize: 10 }, null), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.projectsTotal).toBe(137);
    });

    getMock.mockResolvedValue({ data: { data: [], total: 0, page: 1, pageSize: 10 } });
  });
});
