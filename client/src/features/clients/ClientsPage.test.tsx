// SEC-106: ClientsPage.tsx always rendered the "Ajouter un client" button, even for a user
// without the clients.create permission — inconsistent with LeadsPage.tsx, which already gates
// its equivalent button behind usePermission("leads", "create"). A MANAGER without write access
// would see the button, fill the form, and only then get a 403 (POST /clients is actually
// authorize("ADMIN") only server-side — a MANAGER's usePermission("clients", "create") always
// resolves false, so gating here never blocks a legitimate action).
//
// This renders the real ClientsPage, mocking only its data hooks (not its rendering logic), and
// confirms the create button is present when usePermission returns true and absent when it
// returns false.

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi, beforeAll } from "vitest";
import i18n from "@/i18n";

vi.mock("@/hooks/useClients", () => ({
  useClients: () => ({ data: { data: [], total: 0 }, isLoading: false }),
  useClientTrash: () => ({ data: { data: [], total: 0 }, isLoading: false }),
  useCreateClient: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateClient: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteClient: () => ({ mutate: vi.fn(), isPending: false }),
  useRestoreClient: () => ({ mutate: vi.fn(), isPending: false }),
}));

let mockCanCreate = true;
vi.mock("@/hooks/usePermission", () => ({
  usePermission: () => mockCanCreate,
}));

const { ClientsPage } = await import("./ClientsPage");

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

function renderPage() {
  return render(
    <MemoryRouter>
      <ClientsPage />
    </MemoryRouter>
  );
}

describe("ClientsPage — create button permission gate (SEC-106)", () => {
  test("shows the 'Ajouter un client' button when the user has clients.create permission", () => {
    mockCanCreate = true;
    renderPage();
    expect(screen.getByText("Ajouter un client")).toBeInTheDocument();
  });

  test("hides the 'Ajouter un client' button when the user lacks clients.create permission", () => {
    mockCanCreate = false;
    renderPage();
    expect(screen.queryByText("Ajouter un client")).not.toBeInTheDocument();
  });
});
