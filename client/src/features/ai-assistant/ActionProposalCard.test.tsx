// SEC-059 follow-up: the confirmation card is the ONLY path from a model proposal to a real write
// (non-negotiable design rule) — this test renders the real ActionProposalCard and clicks the real
// "Confirmer" button, asserting it calls the exact same REST-backed API function (tasksApi.create/
// tasksApi.update/leadsApi.updateLeadStatus) every other part of the app already uses for these
// actions — not a reimplementation, not a new/parallel write path. Mocks the API layer only (same
// pattern as useFreelancerApplications.test.tsx), never the mutation hooks themselves.

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, test, vi, beforeAll, beforeEach } from "vitest";
import type { ReactNode } from "react";
import i18n from "@/i18n";
import { ActionProposalCard } from "./ActionProposalCard";
import type { AiActionProposal } from "./actionProposal";

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

const createTaskMock = vi.fn();
const updateTaskMock = vi.fn();
vi.mock("@/api/tasks.api", () => ({
  tasksApi: {
    create: (...args: unknown[]) => createTaskMock(...args),
    update: (...args: unknown[]) => updateTaskMock(...args),
  },
}));

const updateLeadStatusMock = vi.fn();
vi.mock("@/api/leads.api", () => ({
  leadsApi: {
    updateLeadStatus: (...args: unknown[]) => updateLeadStatusMock(...args),
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

beforeEach(() => {
  createTaskMock.mockReset();
  updateTaskMock.mockReset();
  updateLeadStatusMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function renderCard(proposal: AiActionProposal) {
  return render(<ActionProposalCard proposal={proposal} />, { wrapper });
}

describe("ActionProposalCard — createTask (SEC-059 follow-up)", () => {
  test("clicking Confirmer calls the real tasksApi.create with the proposed payload, not a new write path", async () => {
    createTaskMock.mockResolvedValue({ id: "t1", title: "Rédiger le brief", status: "TODO" });
    const proposal: AiActionProposal = {
      type: "createTask", valid: true, projectId: "p1", projectName: "Refonte site", title: "Rédiger le brief",
    };
    renderCard(proposal);

    await userEvent.click(screen.getByRole("button", { name: /confirmer/i }));

    await waitFor(() => expect(createTaskMock).toHaveBeenCalledWith({
      title: "Rédiger le brief", description: undefined, projectId: "p1", assigneeId: undefined,
    }));
    expect(await screen.findByText(/action effectuée/i)).toBeInTheDocument();
  });

  test("clicking Annuler never calls the API, and shows a cancelled state", async () => {
    const proposal: AiActionProposal = {
      type: "createTask", valid: true, projectId: "p1", projectName: "Refonte site", title: "Rédiger le brief",
    };
    renderCard(proposal);

    await userEvent.click(screen.getByRole("button", { name: /annuler/i }));

    expect(createTaskMock).not.toHaveBeenCalled();
    expect(await screen.findByText(/annulée/i)).toBeInTheDocument();
  });

  test("a server-side rejection on confirm shows the real error message, not a generic one", async () => {
    createTaskMock.mockRejectedValue(new Error("PROJECT_ARCHIVED"));
    const proposal: AiActionProposal = {
      type: "createTask", valid: true, projectId: "p1", projectName: "Refonte site", title: "Rédiger le brief",
    };
    renderCard(proposal);

    await userEvent.click(screen.getByRole("button", { name: /confirmer/i }));

    expect(await screen.findByText("PROJECT_ARCHIVED")).toBeInTheDocument();
  });
});

describe("ActionProposalCard — updateLeadStatus (SEC-059 follow-up)", () => {
  test("clicking Confirmer calls the real leadsApi.updateLeadStatus with the proposed transition", async () => {
    updateLeadStatusMock.mockResolvedValue({ id: "l1", status: "QUALIFIED" });
    const proposal: AiActionProposal = {
      type: "updateLeadStatus", valid: true, leadId: "l1", leadName: "Acme Corp", fromStatus: "NEW", toStatus: "QUALIFIED",
    };
    renderCard(proposal);

    await userEvent.click(screen.getByRole("button", { name: /confirmer/i }));

    await waitFor(() => expect(updateLeadStatusMock).toHaveBeenCalledWith("l1", "QUALIFIED", undefined));
  });
});

describe("ActionProposalCard — updateTaskStatus (SEC-059 follow-up)", () => {
  test("clicking Confirmer calls the real tasksApi.update with only the status field", async () => {
    updateTaskMock.mockResolvedValue({ id: "t1", status: "IN_PROGRESS" });
    const proposal: AiActionProposal = {
      type: "updateTaskStatus", valid: true, taskId: "t1", taskTitle: "Rédiger le brief", fromStatus: "TODO", toStatus: "IN_PROGRESS",
    };
    renderCard(proposal);

    await userEvent.click(screen.getByRole("button", { name: /confirmer/i }));

    await waitFor(() => expect(updateTaskMock).toHaveBeenCalledWith("t1", { status: "IN_PROGRESS" }));
  });
});

describe("ActionProposalCard — invalid proposal (SEC-059 follow-up)", () => {
  test("an invalid proposal renders the reason, with no confirm/cancel buttons at all", () => {
    renderCard({ type: "updateTaskStatus", valid: false, reason: "Cette tâche est déjà au statut DONE." });

    expect(screen.getByText("Cette tâche est déjà au statut DONE.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /confirmer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /annuler/i })).not.toBeInTheDocument();
  });
});
