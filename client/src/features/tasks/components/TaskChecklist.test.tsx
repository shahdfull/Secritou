// SEC-060 (sous-tâches, item 4 du constat P1 rapport Product Owner) : aucune checklist n'existait
// sur une tâche. Ce test rend le composant réel, mockant seulement apiClient (pas la logique des
// hooks useTaskChecklist), et vérifie l'affichage, l'ajout, le basculement fait/pas fait et la
// suppression appellent réellement les bonnes requêtes HTTP.

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, test, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { TaskChecklist } from "./TaskChecklist";

const getMock = vi.fn();
const postMock = vi.fn();
const putMock = vi.fn();
const deleteMock = vi.fn();
vi.mock("@/api/axios", () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    put: (...args: unknown[]) => putMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  getMock.mockReset();
  postMock.mockReset();
  putMock.mockReset();
  deleteMock.mockReset();
});

describe("TaskChecklist — SEC-060", () => {
  test("renders existing items with their done state and the completion count", async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          { id: "item-1", title: "Première étape", done: true, position: 0, taskId: "task-1", createdAt: "", updatedAt: "" },
          { id: "item-2", title: "Deuxième étape", done: false, position: 1, taskId: "task-1", createdAt: "", updatedAt: "" },
        ],
      },
    });

    render(<TaskChecklist taskId="task-1" />, { wrapper: makeWrapper() });

    expect(await screen.findByText("Première étape")).toBeInTheDocument();
    expect(screen.getByText("Deuxième étape")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  test("adding an item calls the real POST /tasks/:taskId/checklist", async () => {
    const user = userEvent.setup();
    getMock.mockResolvedValue({ data: { data: [] } });
    postMock.mockResolvedValue({ data: { data: { id: "item-new", title: "Nouvelle étape", done: false, position: 0, taskId: "task-1", createdAt: "", updatedAt: "" } } });

    render(<TaskChecklist taskId="task-1" />, { wrapper: makeWrapper() });

    const input = await screen.findByPlaceholderText("Ajouter une sous-tâche...");
    await user.type(input, "Nouvelle étape");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/tasks/task-1/checklist", { title: "Nouvelle étape" });
    });
  });

  test("toggling an item calls the real PUT with done: true", async () => {
    const user = userEvent.setup();
    getMock.mockResolvedValue({
      data: { data: [{ id: "item-1", title: "À cocher", done: false, position: 0, taskId: "task-1", createdAt: "", updatedAt: "" }] },
    });
    putMock.mockResolvedValue({ data: { data: {} } });

    render(<TaskChecklist taskId="task-1" />, { wrapper: makeWrapper() });

    const checkbox = await screen.findByLabelText(/Marquer "À cocher" comme terminée/);
    await user.click(checkbox);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/tasks/task-1/checklist/item-1", { done: true });
    });
  });

  test("deleting an item calls the real DELETE endpoint", async () => {
    const user = userEvent.setup();
    getMock.mockResolvedValue({
      data: { data: [{ id: "item-1", title: "À supprimer", done: false, position: 0, taskId: "task-1", createdAt: "", updatedAt: "" }] },
    });
    deleteMock.mockResolvedValue({ data: {} });

    render(<TaskChecklist taskId="task-1" />, { wrapper: makeWrapper() });

    const deleteButton = await screen.findByLabelText("Supprimer");
    await user.click(deleteButton);

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith("/tasks/task-1/checklist/item-1");
    });
  });
});
