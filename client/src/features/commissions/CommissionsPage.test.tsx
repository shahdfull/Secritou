// RG-026 (Niveau 2 — confirmation renforcée) : marquer une commission comme payée est une
// action irréversible à enjeu financier direct, listée dans REFERENTIEL.md §5 comme une des 7
// actions Niveau 2. Ce test rend la vraie CommissionsPage (mock uniquement d'@/api/axios) et
// prouve que POST /commissions/:id/mark-paid n'est jamais envoyé tant que la case à cocher
// obligatoire du dialogue n'a pas été cochée — pas un test visuel, un test du flux réel.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import i18n from "@/i18n";

const getMock = vi.fn();
const postMock = vi.fn();
vi.mock("@/api/axios", () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
  },
}));

vi.mock("@/store/auth.store", () => ({
  useAuthStore: (selector: (s: { user: { role: string } }) => unknown) => selector({ user: { role: "ADMIN" } }),
}));

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

const commission = {
  id: "commission-1",
  partnerId: "partner-1",
  projectId: "project-1",
  invoiceId: "invoice-1",
  paymentId: "payment-1",
  basis: 1000,
  ratePct: 20,
  amount: 200,
  status: "PENDING",
  createdAt: "2026-01-01T00:00:00.000Z",
  partner: { id: "partner-1", name: "Jane Doe", email: "jane@example.com" },
  project: { id: "project-1", name: "Site vitrine" },
  invoice: { id: "invoice-1", number: "INV-202601-0001" },
};

beforeEach(async () => {
  getMock.mockReset();
  postMock.mockReset();
  await i18n.changeLanguage("fr");

  getMock.mockImplementation((url: string) => {
    if (url === "/commissions/summary") {
      return Promise.resolve({ data: { data: [{ partnerId: "partner-1", pending: 200, paid: 0 }] } });
    }
    if (url === "/commissions") {
      return Promise.resolve({ data: { data: [commission], total: 1, page: 1, pageSize: 10 } });
    }
    if (url === "/users") {
      return Promise.resolve({ data: { data: [{ id: "partner-1", name: "Jane Doe" }], total: 1, page: 1, pageSize: 200 } });
    }
    return Promise.resolve({ data: { data: [] } });
  });
});

const { CommissionsPage } = await import("./CommissionsPage");

describe("CommissionsPage — mark-paid requires reinforced confirmation (RG-026)", () => {
  test("clicking the mark-paid action does not call the API before the dialog opens", async () => {
    render(<CommissionsPage />, { wrapper: makeWrapper() });

    await screen.findByTitle("Marquer comme payée");
    expect(postMock).not.toHaveBeenCalled();
  });

  test("confirming without checking the mandatory checkbox never sends the mark-paid request", async () => {
    const user = userEvent.setup();
    render(<CommissionsPage />, { wrapper: makeWrapper() });

    await user.click(await screen.findByTitle("Marquer comme payée"));

    const confirmButton = await screen.findByRole("button", { name: "Confirmer" });
    expect(confirmButton).toBeDisabled();

    await user.click(confirmButton);
    expect(postMock).not.toHaveBeenCalledWith("/commissions/commission-1/mark-paid");
  });

  test("checking the checkbox then confirming sends exactly one mark-paid request", async () => {
    postMock.mockResolvedValueOnce({ data: { data: { ...commission, status: "PAID", paidAt: "2026-07-28T00:00:00.000Z" } } });
    const user = userEvent.setup();
    render(<CommissionsPage />, { wrapper: makeWrapper() });

    await user.click(await screen.findByTitle("Marquer comme payée"));

    const checkbox = await screen.findByRole("checkbox");
    await user.click(checkbox);

    const confirmButton = screen.getByRole("button", { name: "Confirmer" });
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock).toHaveBeenCalledWith("/commissions/commission-1/mark-paid");
  });
});
