// SEC-061 (rapport Product Owner, §7 constat P3, session 2026-07-19) : le CLIENT ne voyait son
// projet qu'à travers la timeline synthétique et le brief — jamais le détail des tâches. Ce test
// rend le composant réel et vérifie qu'il affiche les tâches terminées (titre + date), masque le
// détail interne (pas d'assignee/description/priorité affichés), et ne rend rien si la liste est
// vide (pas de section "Ce qui a été livré" pour un projet sans rien de terminé).

import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, test, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { CompletedTasksList } from "./CompletedTasksList";

const getMock = vi.fn();
vi.mock("@/api/axios", () => ({
  default: { get: (...args: unknown[]) => getMock(...args) },
}));

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  getMock.mockReset();
});

describe("CompletedTasksList — SEC-061", () => {
  test("renders completed tasks with title and date", async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          { id: "task-1", title: "Maquette validée", completedAt: "2026-07-01T00:00:00.000Z" },
          { id: "task-2", title: "Développement terminé", completedAt: "2026-07-10T00:00:00.000Z" },
        ],
      },
    });

    render(<CompletedTasksList projectId="project-1" />, { wrapper: makeWrapper() });

    expect(await screen.findByText("Maquette validée")).toBeInTheDocument();
    expect(screen.getByText("Développement terminé")).toBeInTheDocument();
    expect(screen.getByText("Ce qui a été livré")).toBeInTheDocument();
  });

  test("renders nothing when there are no completed tasks", async () => {
    getMock.mockResolvedValue({ data: { data: [] } });

    const { container } = render(<CompletedTasksList projectId="project-1" />, { wrapper: makeWrapper() });

    await vi.waitFor(() => {
      expect(getMock).toHaveBeenCalled();
    });
    expect(container.textContent).not.toContain("Ce qui a été livré");
  });

  test("calls the real GET /projects/:id/completed-tasks endpoint", async () => {
    getMock.mockResolvedValue({ data: { data: [] } });

    render(<CompletedTasksList projectId="project-42" />, { wrapper: makeWrapper() });

    await vi.waitFor(() => {
      expect(getMock).toHaveBeenCalledWith("/projects/project-42/completed-tasks");
    });
  });
});
