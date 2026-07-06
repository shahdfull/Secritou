import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, test, vi, beforeEach, beforeAll } from "vitest";
import type { ReactNode } from "react";
import i18n from "@/i18n";
import { useLogin } from "./useAuth";

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

const loginMock = vi.fn();
vi.mock("../api/auth.api", () => ({
  authApi: {
    login: (...args: unknown[]) => loginMock(...args),
  },
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

describe("useLogin error handling", () => {
  beforeEach(() => {
    loginMock.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  test("401 shows the invalid-credentials toast and re-enables the mutation", async () => {
    loginMock.mockRejectedValueOnce(axiosErrorWithStatus(401));
    const { result } = renderHook(() => useLogin(), { wrapper });

    result.current.mutate({ email: "a@b.com", password: "wrongpass" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastError).toHaveBeenCalledWith("Email ou mot de passe incorrect.");
    expect(result.current.isPending).toBe(false);
  });

  test("429 shows the too-many-attempts toast", async () => {
    loginMock.mockRejectedValueOnce(axiosErrorWithStatus(429));
    const { result } = renderHook(() => useLogin(), { wrapper });

    result.current.mutate({ email: "a@b.com", password: "somepass1" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastError).toHaveBeenCalledWith("Trop de tentatives. Réessayez dans quelques minutes.");
  });

  test("network error (no response) shows the generic network toast", async () => {
    const networkError = new AxiosError("Network Error");
    loginMock.mockRejectedValueOnce(networkError);
    const { result } = renderHook(() => useLogin(), { wrapper });

    result.current.mutate({ email: "a@b.com", password: "somepass1" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastError).toHaveBeenCalledWith("Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.");
  });
});
