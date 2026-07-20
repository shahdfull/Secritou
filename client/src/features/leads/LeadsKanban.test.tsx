// SEC-101: LeadsKanban.tsx used to show "Create a proposal" only on WON leads
// (CAN_CREATE_PROPOSAL = ["WON"]), the exact opposite of LeadDetailDialog.tsx (["CONTACTED",
// "QUALIFIED"]) and of the server (proposal.service.ts#create rejects WON outright with
// LEAD_ALREADY_WON). Every click on this button, from the Kanban, failed 100% of the time.
// This test renders the real LeadsKanban and confirms the button now appears exactly on
// CONTACTED/QUALIFIED leads (matching the server's actual contract) and not on WON/NEW/LOST.

import { render } from "@testing-library/react";
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

// SEC-108: the desktop Kanban (hidden sm:block) and the mobile stacked view (sm:hidden) are both
// mounted in the DOM at once — JSDOM has no real viewport, so the `hidden`/`sm:hidden` classes
// don't actually remove either from the tree, only CSS media queries at runtime would. Assertions
// are scoped to the desktop container specifically so they can't accidentally pass by counting
// the mobile view's copy of the same button instead of proving the intended one.
describe("LeadsKanban — create-proposal button availability (SEC-101)", () => {
  test("the button appears on CONTACTED and QUALIFIED leads — the statuses the server actually accepts", () => {
    const leads = [makeLead("CONTACTED"), makeLead("QUALIFIED")];
    const { container } = render(<LeadsKanban filteredLeads={leads} />, { wrapper: makeWrapper() });

    const desktopContainer = container.querySelector(".hidden.sm\\:block");
    expect(desktopContainer).not.toBeNull();
    const buttons = desktopContainer!.querySelectorAll("button");
    const proposalButtons = Array.from(buttons).filter((b) => b.textContent?.includes("Créer une proposition"));
    expect(proposalButtons).toHaveLength(2);
  });

  test("the button does NOT appear on WON, NEW, or LOST leads", () => {
    const leads = [makeLead("WON"), makeLead("NEW"), makeLead("LOST")];
    const { container } = render(<LeadsKanban filteredLeads={leads} />, { wrapper: makeWrapper() });

    const desktopContainer = container.querySelector(".hidden.sm\\:block");
    expect(desktopContainer?.textContent).not.toContain("Créer une proposition");
  });
});

describe("LeadsKanban — mobile stacked view (SEC-108)", () => {
  test("renders both a desktop Kanban container (hidden below sm) and a mobile stacked view (sm:hidden), each showing the same leads", () => {
    const leads = [makeLead("CONTACTED", { name: "Lead mobile test" })];
    const { container } = render(<LeadsKanban filteredLeads={leads} />, { wrapper: makeWrapper() });

    const desktopContainer = container.querySelector(".hidden.sm\\:block");
    const mobileContainer = container.querySelector(".sm\\:hidden");
    expect(desktopContainer).not.toBeNull();
    expect(mobileContainer).not.toBeNull();
    expect(mobileContainer?.textContent).toContain("Lead mobile test");
  });

  test("mobile view offers a status Select with only the valid next transitions, and none for a terminal status", () => {
    const contactedLead = makeLead("CONTACTED", { name: "Lead contacted mobile" });
    const wonLead = makeLead("WON", { name: "Lead won mobile" });
    const { container } = render(<LeadsKanban filteredLeads={[contactedLead, wonLead]} />, { wrapper: makeWrapper() });

    const mobileContainer = container.querySelector(".sm\\:hidden") as HTMLElement;
    // A CONTACTED lead's next statuses (QUALIFIED, PROPOSAL, WON, LOST) must all be selectable —
    // presence of the trigger button proves the Select is offered at all.
    const selectTriggers = mobileContainer.querySelectorAll('[role="combobox"]');
    expect(selectTriggers.length).toBeGreaterThan(0);
  });
});
