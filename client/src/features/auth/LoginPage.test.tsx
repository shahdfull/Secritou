import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";
import "@/i18n";
import { LoginPage } from "./LoginPage";

const loginMutate = vi.fn();

vi.mock("@/hooks/useAuth", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useAuth")>("@/hooks/useAuth");
  return {
    ...actual,
    useLogin: () => ({ mutate: loginMutate, isPending: false }),
  };
});

function renderLoginPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("LoginPage password validation", () => {
  test("a 7-character password shows a validation error and does not call login", async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByPlaceholderText(/email/i), "user@example.com");
    await user.type(screen.getByPlaceholderText(/mot de passe|password/i), "abcdefg");
    await user.click(screen.getByRole("button", { name: /connexion|sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/8 caractères|8 characters/i)).toBeInTheDocument();
    });
    expect(loginMutate).not.toHaveBeenCalled();
  });

  test("an 8-character password passes validation and triggers login", async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByPlaceholderText(/email/i), "user@example.com");
    await user.type(screen.getByPlaceholderText(/mot de passe|password/i), "abcdefgh");
    await user.click(screen.getByRole("button", { name: /connexion|sign in/i }));

    await waitFor(() => {
      expect(loginMutate).toHaveBeenCalledTimes(1);
    });
  });
});
