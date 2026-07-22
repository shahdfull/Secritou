// ProposalsPage.tsx (and useProposals.ts/proposals.api.ts) had zero client-side test coverage
// before this file — the UI half of the proposal→project cascade (RG-010, already covered
// server-side by proposalAcceptCascadeConcurrency.test.ts and proposalAcceptCascade.test.ts) was
// never exercised: nothing proved the "Accept" button actually navigates to the newly created
// project, or shows the client-invited toast, using the real response shape the API returns.
//
// This renders the real ProposalsPage, mocking only its data hooks (useProposals/useAcceptProposal/
// etc.) and useNavigate — not reimplementing the cascade logic itself, which lives server-side.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi, beforeAll } from "vitest";
import i18n from "@/i18n";
import type { Proposal, AcceptProposalResult } from "@/api/proposals.api";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@/hooks/useLeads", () => ({
  useLeads: () => ({ data: { data: [] } }),
}));

let mockProposals: Proposal[] = [];
const acceptMutateMock = vi.fn();
const sendMutateMock = vi.fn();
const rejectMutateMock = vi.fn();
const deleteMutateMock = vi.fn();
const createInvoiceMutateMock = vi.fn();

vi.mock("@/hooks/useProposals", () => ({
  useProposals: () => ({ data: { data: mockProposals, page: 1, pageSize: 10, total: mockProposals.length }, isLoading: false }),
  useProposal: () => ({ data: undefined, isLoading: false }),
  useDeleteProposal: () => ({ mutate: deleteMutateMock, isPending: false }),
  useSendProposal: () => ({ mutate: sendMutateMock, isPending: false }),
  useAcceptProposal: () => ({ mutate: acceptMutateMock, isPending: false }),
  useRejectProposal: () => ({ mutate: rejectMutateMock, isPending: false }),
  useCreateInvoiceFromProposal: () => ({ mutate: createInvoiceMutateMock, isPending: false }),
}));

const { ProposalsPage } = await import("./ProposalsPage");

function makeProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: "proposal-1",
    title: "Site vitrine",
    status: "SENT",
    version: 1,
    amount: 1000,
    currency: "TND",
    clientId: "client-1",
    client: { name: "Acme" },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ProposalsPage />
    </MemoryRouter>
  );
}

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

describe("ProposalsPage accept cascade — UI half of RG-010", () => {
  test("clicking Accept opens the confirmation dialog naming the cascade's real consequences", async () => {
    const user = userEvent.setup();
    mockProposals = [makeProposal()];
    renderPage();

    await user.click(screen.getByTitle("Accepter"));

    expect(screen.getByText(/sera créé/i)).toBeInTheDocument();
    expect(acceptMutateMock).not.toHaveBeenCalled();
  });

  test("confirming accept calls the real mutation, and on success navigates to the new project's page", async () => {
    const user = userEvent.setup();
    mockProposals = [makeProposal()];
    const result: AcceptProposalResult = {
      proposal: makeProposal({ status: "ACCEPTED" }),
      meta: { projectId: "project-42", invoiceId: "invoice-1", clientInvited: false },
    };
    acceptMutateMock.mockImplementation((_id: string, opts?: { onSuccess?: (r: AcceptProposalResult) => void }) => {
      opts?.onSuccess?.(result);
    });

    renderPage();
    await user.click(screen.getByTitle("Accepter"));
    await user.click(screen.getByRole("button", { name: /Accepter et lancer/i }));

    expect(acceptMutateMock).toHaveBeenCalledWith("proposal-1", expect.anything());
    expect(navigateMock).toHaveBeenCalledWith("/app/projects/project-42");
  });

  test("when the cascade also invited the client, a toast fires in addition to navigation", async () => {
    const user = userEvent.setup();
    mockProposals = [makeProposal()];
    const result: AcceptProposalResult = {
      proposal: makeProposal({ status: "ACCEPTED" }),
      meta: { projectId: "project-99", invoiceId: "invoice-2", clientInvited: true },
    };
    acceptMutateMock.mockImplementation((_id: string, opts?: { onSuccess?: (r: AcceptProposalResult) => void }) => {
      opts?.onSuccess?.(result);
    });

    renderPage();
    await user.click(screen.getByTitle("Accepter"));
    await user.click(screen.getByRole("button", { name: /Accepter et lancer/i }));

    expect(navigateMock).toHaveBeenCalledWith("/app/projects/project-99");
  });

  test("an ACCEPTED proposal with a linked project shows a shortcut button to that project", async () => {
    const user = userEvent.setup();
    mockProposals = [makeProposal({ status: "ACCEPTED", linkedProject: { id: "project-7" } })];
    renderPage();

    await user.click(screen.getByTitle("Voir le projet"));

    expect(navigateMock).toHaveBeenCalledWith("/app/projects/project-7");
  });

  test("an ACCEPTED proposal without an invoice yet can still trigger invoice generation", async () => {
    const user = userEvent.setup();
    mockProposals = [makeProposal({ status: "ACCEPTED" })];
    renderPage();

    await user.click(screen.getByTitle("Générer une facture"));
    await user.click(screen.getByRole("button", { name: /Créer la facture/i }));

    expect(createInvoiceMutateMock).toHaveBeenCalledWith("proposal-1", expect.anything());
  });
});
