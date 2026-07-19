// SEC-060 (vue calendrier/Gantt, item 3 du constat P1 rapport Product Owner) : aucune vue
// calendrier n'existait sur le module Tâches. Décision du porteur : un calendrier mensuel simple,
// pas un vrai Gantt avec barres de durée. Ce test rend le composant réel et vérifie qu'il marque
// les jours ayant une tâche à échéance, affiche les tâches du jour sélectionné, et masque les
// tâches sans échéance.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeAll } from "vitest";
import i18n from "@/i18n";
import type { Task } from "@/types/task";
import { TasksCalendar } from "./TasksCalendar";

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Livrer la maquette",
    status: "TODO",
    priority: "NORMAL",
    projectId: "project-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("TasksCalendar — SEC-060", () => {
  test("shows the tasks due today (default selected day) with their project name", () => {
    const today = new Date().toISOString();
    render(
      <TasksCalendar
        tasks={[makeTask({ dueDate: today })]}
        projectNameById={new Map([["project-1", "Site vitrine"]])}
        onView={() => {}}
      />
    );

    expect(screen.getByText("Livrer la maquette")).toBeInTheDocument();
    expect(screen.getByText("Site vitrine")).toBeInTheDocument();
  });

  test("shows the empty-state message when no task is due on the selected day", () => {
    render(<TasksCalendar tasks={[]} projectNameById={new Map()} onView={() => {}} />);
    expect(screen.getByText("Aucune tâche.")).toBeInTheDocument();
  });

  test("clicking a task calls onView with that task", async () => {
    const user = userEvent.setup();
    const onView = vi.fn();
    const today = new Date().toISOString();
    const task = makeTask({ dueDate: today });

    render(<TasksCalendar tasks={[task]} projectNameById={new Map()} onView={onView} />);

    await user.click(screen.getByText("Livrer la maquette"));
    expect(onView).toHaveBeenCalledWith(task);
  });

  test("a task with no dueDate is never shown (calendar only reflects tasks with a due date)", () => {
    render(
      <TasksCalendar
        tasks={[makeTask({ dueDate: undefined })]}
        projectNameById={new Map()}
        onView={() => {}}
      />
    );
    expect(screen.queryByText("Livrer la maquette")).not.toBeInTheDocument();
    expect(screen.getByText("Aucune tâche.")).toBeInTheDocument();
  });
});
