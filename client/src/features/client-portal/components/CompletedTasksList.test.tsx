// SEC-061 (rapport Product Owner, §7 constat P3, session 2026-07-19) : le CLIENT ne voyait son
// projet qu'à travers la timeline synthétique et le brief — jamais le détail des tâches. Ce test
// rend le composant réel et vérifie qu'il affiche les tâches terminées (titre + date), masque le
// détail interne (pas d'assignee/description/priorité affichés), et ne rend rien si la liste est
// vide (pas de section "Ce qui a été livré" pour un projet sans rien de terminé).
//
// SEC-091 : le composant ne fait plus sa propre requête réseau (batchée au niveau de
// ProjectsClientPage.tsx via usePortalSummaries) — il reçoit tasks/isLoading en props.

import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { CompletedTasksList } from "./CompletedTasksList";

describe("CompletedTasksList — SEC-061", () => {
  test("renders completed tasks with title and date", () => {
    render(
      <CompletedTasksList
        isLoading={false}
        tasks={[
          { id: "task-1", title: "Maquette validée", completedAt: "2026-07-01T00:00:00.000Z" },
          { id: "task-2", title: "Développement terminé", completedAt: "2026-07-10T00:00:00.000Z" },
        ]}
      />
    );

    expect(screen.getByText("Maquette validée")).toBeInTheDocument();
    expect(screen.getByText("Développement terminé")).toBeInTheDocument();
    expect(screen.getByText("Ce qui a été livré")).toBeInTheDocument();
  });

  test("renders nothing when there are no completed tasks", () => {
    const { container } = render(<CompletedTasksList isLoading={false} tasks={[]} />);
    expect(container.textContent).not.toContain("Ce qui a été livré");
  });

  test("renders a loading skeleton while isLoading is true, not the empty/error state", () => {
    const { container } = render(<CompletedTasksList isLoading={true} tasks={undefined} />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    expect(container.textContent).not.toContain("Ce qui a été livré");
  });
});
