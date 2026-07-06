import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, test, vi, beforeEach, beforeAll } from "vitest";
import type { ReactNode } from "react";
import i18n from "@/i18n";
import { useCreateFreelancerApplication } from "./useFreelancerApplications";

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

const createApplicationMock = vi.fn();
vi.mock("../api/freelancerApplications.api", () => ({
  freelancerApplicationsApi: {
    createApplication: (...args: unknown[]) => createApplicationMock(...args),
  },
  authApi: { changePassword: vi.fn() },
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function axiosErrorWithStatus(status: number) {
  return new AxiosError("Request failed", String(status), undefined, undefined, {
    status,
    statusText: String(status),
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() } as never,
    data: {},
  });
}

function buildFormData() {
  const formData = new FormData();
  formData.append("firstName", "Jane");
  return formData;
}

describe("useCreateFreelancerApplication error handling", () => {
  beforeEach(() => {
    createApplicationMock.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  test("a 500 error shows the generic submit-error toast", async () => {
    createApplicationMock.mockRejectedValueOnce(axiosErrorWithStatus(500));
    const { result } = renderHook(() => useCreateFreelancerApplication(), { wrapper });

    result.current.mutate(buildFormData());

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastError).toHaveBeenCalledWith(
      "L'envoi a échoué. Réessayez ou écrivez-nous à hello@secritou.com."
    );
    expect(result.current.isPending).toBe(false);
  });

  test("a 413 error shows the file-too-large toast", async () => {
    createApplicationMock.mockRejectedValueOnce(axiosErrorWithStatus(413));
    const { result } = renderHook(() => useCreateFreelancerApplication(), { wrapper });

    result.current.mutate(buildFormData());

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastError).toHaveBeenCalledWith("Fichier trop volumineux. CV max 10 Mo, portfolio max 20 Mo.");
  });

  test("a 415 error shows the invalid-file-type toast", async () => {
    createApplicationMock.mockRejectedValueOnce(axiosErrorWithStatus(415));
    const { result } = renderHook(() => useCreateFreelancerApplication(), { wrapper });

    result.current.mutate(buildFormData());

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastError).toHaveBeenCalledWith("Type de fichier non accepté. Vérifiez le format demandé.");
  });

  test("createApplication is called with the FormData instance as-is (no JSON conversion)", async () => {
    createApplicationMock.mockResolvedValueOnce({ id: "app-1" });
    const { result } = renderHook(() => useCreateFreelancerApplication(), { wrapper });
    const formData = buildFormData();

    result.current.mutate(formData);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createApplicationMock).toHaveBeenCalledWith(formData);
  });
});
