// SEC-057 (U3 + U4, rapport designer UI/UX, session 2026-07-19):
// U3 — the icon-only view/edit/delete buttons on each project card had no aria-label (only a
//      lucide icon), confirmed by direct read of ProjectGrid in this file.
// U4 — nothing explained the absence of a "Nouveau projet" button to ADMIN/MANAGER (removed in
//      SEC-039/046 because a project is only ever created via an accepted proposal).
//
// This renders the real ProjectsPage, mocking only its data hooks (not its rendering logic), and
// proves both: the contextual notice is visible for ADMIN/MANAGER, and each icon-only project
// action button has a real accessible name.

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi, beforeAll } from "vitest";
import i18n from "@/i18n";
import type { Project } from "@/types/project";

vi.mock("@/hooks/useClients", () => ({
  useClients: () => ({ data: { data: [], total: 0 }, isLoading: false }),
}));

vi.mock("@/hooks/usePermission", () => ({
  usePermission: () => true,
}));

vi.mock("@/features/tasks/TasksPage", () => ({ TasksPage: () => null }));
vi.mock("@/features/documents/DocumentsPage", () => ({ DocumentsPage: () => null }));

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "project-1",
    name: "Site vitrine",
    status: "IN_PROGRESS",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    progress: 40,
    taskDone: 2,
    taskTotal: 5,
    ...overrides,
  };
}

vi.mock("@/hooks/useProjects", () => ({
  useProjects: () => ({ data: { data: [makeProject()], total: 1 }, isLoading: false }),
  useProjectTrash: () => ({ data: { data: [], total: 0 }, isLoading: false }),
  useUpdateProject: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteProject: () => ({ mutate: vi.fn(), isPending: false }),
  useRestoreProject: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/store/auth.store", () => ({
  useAuthStore: (selector: (s: { user: { role: string } }) => unknown) => selector({ user: { role: "ADMIN" } }),
}));

const { ProjectsPage } = await import("./ProjectsPage");

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

function renderPage() {
  return render(
    <MemoryRouter>
      <ProjectsPage />
    </MemoryRouter>
  );
}

describe("ProjectsPage — SEC-057 (U3 icon-button labels, U4 contextual notice)", () => {
  test("shows the contextual notice explaining the absence of a 'Nouveau projet' button for ADMIN/MANAGER", () => {
    renderPage();
    expect(
      screen.getByText("Un projet naît de l'acceptation d'une proposition — il n'y a pas de bouton de création directe ici.")
    ).toBeInTheDocument();
  });

  test("each icon-only project action button has a real accessible name", () => {
    renderPage();
    expect(screen.getByLabelText("Voir")).toBeInTheDocument();
    expect(screen.getByLabelText("Modifier")).toBeInTheDocument();
    expect(screen.getByLabelText("Supprimer")).toBeInTheDocument();
  });
});
