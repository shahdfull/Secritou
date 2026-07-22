// LeadDetailDialog.useLead call never destructured isLoading — while the detailed fetch (with
// linked proposals) was in flight, `current` fell back to the list-sourced `lead` prop, which
// never carries `proposals`. The proposals section rendered "no proposals" even when the lead
// genuinely had some still loading — a false-empty state, not just a missing spinner. Fixed by
// checking isLoading before falling through to the empty-state branch. This test renders the
// real component and asserts the loading indicator appears before the (possibly non-empty)
// result, proving the fix rather than just the absence of a crash.

import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, test, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { LeadDetailDialog } from "./LeadDetailDialog";
import type { Lead } from "@/types/lead";

// CreateProposalFromLeadDialog is mounted alongside LeadDetailDialog (it's rendered
// unconditionally, just closed by default) and fetches its own client list via useClients — a
// single unconditional mock would feed it the lead's response shape and crash on clients.map.
const leadGetMock = vi.fn();
vi.mock("@/api/axios", () => ({
  default: {
    get: (url: string, ...rest: unknown[]) => {
      if (url.startsWith("/leads/")) return leadGetMock(url, ...rest);
      if (url === "/clients") return Promise.resolve({ data: { data: [], total: 0 } });
      return Promise.resolve({ data: { data: [] } });
    },
  },
}));

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const baseLead: Lead = {
  id: "lead-1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  status: "QUALIFIED",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
  // Deliberately omitted here, matching the real list payload — the list endpoint never
  // includes proposals, only the detail endpoint (useLead) does.
};

beforeEach(() => {
  leadGetMock.mockReset();
});

describe("LeadDetailDialog — loading state for linked proposals", () => {
  test("shows a loading indicator instead of a false 'no proposals' message while the detail fetch is in flight", async () => {
    let resolveDetail!: (value: unknown) => void;
    leadGetMock.mockReturnValue(new Promise((resolve) => { resolveDetail = resolve; }));

    render(
      <LeadDetailDialog lead={baseLead} open={true} onOpenChange={() => {}} />,
      { wrapper: makeWrapper() }
    );

    // The test environment's i18n falls back to English (no locale forced), so common.loading
    // renders as "Loading..." here rather than the French "Chargement..." a real French user sees
    // — asserting on the actual rendered text, not the French key content.
    expect(await screen.findByText((_, element) => element?.textContent === "Loading...")).toBeInTheDocument();
    expect(screen.queryByText("No proposals linked to this lead")).not.toBeInTheDocument();

    resolveDetail({
      data: {
        data: {
          ...baseLead,
          proposals: [
            { id: "prop-1", title: "Refonte site vitrine", status: "SENT", currency: "TND", createdAt: "2026-07-05T00:00:00.000Z" },
          ],
        },
      },
    });

    expect(await screen.findByText("Refonte site vitrine")).toBeInTheDocument();
  });

  test("shows the real empty-state message once the detail fetch resolves with no proposals", async () => {
    leadGetMock.mockResolvedValue({ data: { data: { ...baseLead, proposals: [] } } });

    render(
      <LeadDetailDialog lead={baseLead} open={true} onOpenChange={() => {}} />,
      { wrapper: makeWrapper() }
    );

    expect(await screen.findByText("No proposals linked to this lead")).toBeInTheDocument();
    expect(screen.queryByText((_, element) => element?.textContent === "Loading...")).not.toBeInTheDocument();
  });
});
