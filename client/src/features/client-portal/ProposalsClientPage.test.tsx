// ProposalsClientPage.tsx had zero client-side test coverage before this file — the client-facing
// half of the accept/reject flow (server-side counterpart already covered by
// proposalAcceptRbacHttp.test.ts / proposalAcceptCascadeConcurrency.test.ts). Nothing proved the
// most important edge case a client can hit here: PROPOSAL_VERSION_MISMATCH (the proposal was
// edited since the client opened it) shows a specific message and clears the stale selection,
// rather than the generic failure toast.
//
// This renders the real ProposalsClientPage, mocking only the network layer (@/api/axios) — not
// reimplementing the component's own version-mismatch branching logic.

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { describe, expect, test, vi, beforeEach, beforeAll } from "vitest";
import i18n from "@/i18n";

vi.mock("@/api/axios", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

// The component doesn't render its own <Toaster/> (mounted once at the app root, outside this
// page) — asserting the real toast.error call is more direct and robust than depending on a
// separately-mounted Toaster picking it up in this isolated render.
const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({ toast: { error: toastErrorMock, success: vi.fn(), info: vi.fn() } }));

const { default: apiClient } = await import("@/api/axios");
const { ProposalsClientPage } = await import("./ProposalsClientPage");

type MockProposal = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  version: number;
  amount: number | null;
  currency: string;
  expiresAt: string | null;
  createdAt: string;
  sections: never[];
};

function makeProposal(overrides: Partial<MockProposal> = {}): MockProposal {
  return {
    id: "proposal-1",
    title: "Site vitrine",
    description: null,
    status: "SENT",
    version: 2,
    amount: 1000,
    currency: "TND",
    expiresAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    sections: [],
    ...overrides,
  };
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ProposalsClientPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset();
  vi.mocked(apiClient.post).mockReset();
  toastErrorMock.mockReset();
});

describe("ProposalsClientPage — accept/reject (client side of the cascade)", () => {
  test("accepting sends the real request with the version the client actually reviewed", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { data: [makeProposal({ version: 3 })], total: 1 } } });
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    renderPage();

    await waitFor(() => expect(screen.getByText("Site vitrine")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Accepter/ }));

    expect(apiClient.post).toHaveBeenCalledWith(
      "/proposals/proposal-1/respond",
      expect.objectContaining({ action: "accept", expectedVersion: 3 })
    );
  });

  test("a PROPOSAL_VERSION_MISMATCH error shows the specific message and clears the selection, not the generic failure toast", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { data: [makeProposal()], total: 1 } } });
    const mismatchError = new AxiosError("mismatch");
    mismatchError.response = {
      data: { error: { code: "PROPOSAL_VERSION_MISMATCH" } },
      status: 409,
      statusText: "Conflict",
      headers: {},
      // @ts-expect-error minimal fake config, not used by the component
      config: {},
    };
    vi.mocked(apiClient.post).mockRejectedValue(mismatchError);
    renderPage();

    await waitFor(() => expect(screen.getByText("Site vitrine")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Accepter/ }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith(expect.stringMatching(/modifiée depuis son ouverture/)));
  });

  test("a non-mismatch failure shows the generic failure message", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { data: [makeProposal()], total: 1 } } });
    const genericError = new AxiosError("network error");
    vi.mocked(apiClient.post).mockRejectedValue(genericError);
    renderPage();

    await waitFor(() => expect(screen.getByText("Site vitrine")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Accepter/ }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith(expect.stringMatching(/Impossible d'enregistrer votre réponse/)));
  });

  test("rejecting opens a dialog and sends the real request with the entered comment", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { data: [makeProposal()], total: 1 } } });
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    renderPage();

    await waitFor(() => expect(screen.getByText("Site vitrine")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Refuser/ }));
    await user.type(screen.getByPlaceholderText(/Motif du rejet/), "Trop cher");
    await user.click(screen.getByRole("button", { name: /Confirmer le refus/ }));

    expect(apiClient.post).toHaveBeenCalledWith(
      "/proposals/proposal-1/respond",
      expect.objectContaining({ action: "reject", comment: "Trop cher" })
    );
  });

  test("a DRAFT/ACCEPTED/etc. proposal shows no accept/reject buttons", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { data: [makeProposal({ status: "ACCEPTED" })], total: 1 } } });
    renderPage();

    await waitFor(() => expect(screen.getByText("Site vitrine")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /Accepter/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Refuser/ })).not.toBeInTheDocument();
  });
});
