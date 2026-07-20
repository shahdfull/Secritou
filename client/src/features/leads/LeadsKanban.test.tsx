// SEC-101: LeadsKanban.tsx used to show "Create a proposal" only on WON leads
// (CAN_CREATE_PROPOSAL = ["WON"]), the exact opposite of LeadDetailDialog.tsx (["CONTACTED",
// "QUALIFIED"]) and of the server (proposal.service.ts#create rejects WON outright with
// LEAD_ALREADY_WON). Every click on this button, from the Kanban, failed 100% of the time.
// This test renders the real LeadsKanban and confirms the button now appears exactly on
// CONTACTED/QUALIFIED leads (matching the server's actual contract) and not on WON/NEW/LOST.

import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, test, vi, beforeAll } from "vitest";
import type { ReactNode } from "react";
import i18n from "@/i18n";
import type { Lead } from "@/types/lead";
import { LeadsKanban } from "./LeadsKanban";

vi.mock("@/api/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

function makeLead(status: Lead["status"], overrides: Partial<Lead> = {}): Lead {
  return {
    id: `lead-${status}`,
    name: `Lead ${status}`,
    status,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("LeadsKanban — create-proposal button availability (SEC-101)", () => {
  test("the button appears on CONTACTED and QUALIFIED leads — the statuses the server actually accepts", () => {
    const leads = [makeLead("CONTACTED"), makeLead("QUALIFIED")];
    render(<LeadsKanban filteredLeads={leads} />, { wrapper: makeWrapper() });

    const buttons = screen.getAllByText("Créer une proposition");
    expect(buttons).toHaveLength(2);
  });

  test("the button does NOT appear on WON, NEW, or LOST leads", () => {
    const leads = [makeLead("WON"), makeLead("NEW"), makeLead("LOST")];
    render(<LeadsKanban filteredLeads={leads} />, { wrapper: makeWrapper() });

    expect(screen.queryByText("Créer une proposition")).not.toBeInTheDocument();
  });
});
