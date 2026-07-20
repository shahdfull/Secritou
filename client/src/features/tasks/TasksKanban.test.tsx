// SEC-093: a Kanban card's onClick (opening the task detail) had no keyboard equivalent — dnd-kit
// claims Enter/Space for its own pickup gesture on a draggable card, but neither `onClick` nor any
// `onKeyDown` was ever wired to open the detail, so a keyboard-only user could never open a task
// from this view (only the List view had a working "Voir" button). This test renders the real
// TasksKanban, focuses a card, and confirms pressing Enter calls onTaskClick — the same action a
// mouse click already triggers.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, test, vi, beforeAll } from "vitest";
import type { ReactNode } from "react";
import i18n from "@/i18n";
import type { Task } from "@/types/task";
import { TasksKanban } from "./TasksKanban";

vi.mock("@/api/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Carte clavier",
    status: "TODO",
    priority: "NORMAL",
    projectId: "project-1",
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

describe("TasksKanban card keyboard access — SEC-093", () => {
  test("pressing Enter on a focused card calls onTaskClick, same as a mouse click", async () => {
    const user = userEvent.setup();
    const onTaskClick = vi.fn();

    render(<TasksKanban filteredTasks={[makeTask()]} onTaskClick={onTaskClick} />, { wrapper: makeWrapper() });

    const card = screen.getByText("Carte clavier").closest('[role="button"]') as HTMLElement;
    expect(card).not.toBeNull();
    card.focus();
    await user.keyboard("{Enter}");

    expect(onTaskClick).toHaveBeenCalledWith(expect.objectContaining({ id: "task-1" }));
  });
});
