// SEC-095: useCreateChecklistItem/useUpdateChecklistItem/useDeleteChecklistItem had no onError at
// all — a rejection (e.g. 409 PROJECT_ARCHIVED after SEC-089, or 422 CHECKLIST_LIMIT_REACHED)
// failed completely silently, with nothing shown to the user. This test calls the real hooks
// against a mocked apiClient rejection and asserts a toast with the server's actual message is
// shown — not the previous silent failure, and not a hook-level double toast.

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, test, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { AxiosError } from "axios";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const postMock = vi.fn();
vi.mock("@/api/axios", () => ({
  default: { get: vi.fn(), post: (...args: unknown[]) => postMock(...args), put: vi.fn(), delete: vi.fn() },
}));

const { useCreateChecklistItem } = await import("./useTaskChecklist");

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  postMock.mockReset();
  vi.mocked(toast.error).mockReset();
});

describe("useCreateChecklistItem onError — SEC-095", () => {
  test("shows the server's actual error message on a 409 PROJECT_ARCHIVED rejection", async () => {
    const axiosError = new AxiosError("Request failed with status code 409");
    axiosError.response = {
      status: 409,
      data: { error: { code: "PROJECT_ARCHIVED", message: "This project is archived and no longer accepts task changes" } },
    } as AxiosError["response"];
    postMock.mockRejectedValue(axiosError);

    const { result } = renderHook(() => useCreateChecklistItem("task-1"), { wrapper: makeWrapper() });

    act(() => {
      result.current.mutate("Nouvel item");
    });

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toast.error).toHaveBeenCalledWith("This project is archived and no longer accepts task changes");
  });

  test("falls back to a generic message when the server sent no structured error", async () => {
    postMock.mockRejectedValue(new Error("Network Error"));

    const { result } = renderHook(() => useCreateChecklistItem("task-1"), { wrapper: makeWrapper() });

    act(() => {
      result.current.mutate("Nouvel item");
    });

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toast.error).toHaveBeenCalledWith("Erreur lors de l'ajout de la sous-tâche");
  });
});
