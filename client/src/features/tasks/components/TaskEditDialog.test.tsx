// SEC-080: a FREELANCER's edit dialog only renders a status picker, but its Save button used to
// call `form.handleSubmit(onSubmit)` — react-hook-form submits every value the form was
// `reset()` with (title/description/priority/projectId/assigneeId/dates), regardless of which
// fields are actually rendered. task.service.ts#updateTask rejects any FREELANCER payload
// carrying a key other than `status` (403 DISALLOWED_FIELD_UPDATE), so this button always
// failed for that role. This test renders the real component and confirms onSubmit is now
// called with `{ status }` only.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, test, vi, beforeAll } from "vitest";
import i18n from "@/i18n";
import { TaskEditDialog } from "./TaskEditDialog";
import type { UpdateTaskForm } from "@/schemas/task.schema";

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

function Harness({ onSubmit }: { onSubmit: (data: UpdateTaskForm) => void }) {
  const form = useForm<UpdateTaskForm>({
    defaultValues: {
      title: "Full task title",
      description: "Some description",
      status: "TODO",
      priority: "HIGH",
      projectId: "project-1",
      assigneeId: "user-1",
      startDate: "2026-01-01",
      dueDate: "2026-01-10",
    },
  });

  return (
    <TaskEditDialog
      open={true}
      onOpenChange={() => {}}
      form={form}
      projects={[]}
      users={[]}
      isFreelancer={true}
      isUpdating={false}
      onSubmit={onSubmit}
    />
  );
}

describe("TaskEditDialog freelancer status-only submit — SEC-080", () => {
  test("clicking Save submits only { status }, never the other form values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(onSubmit).toHaveBeenCalledWith({ status: "TODO" });
    expect(onSubmit).not.toHaveBeenCalledWith(expect.objectContaining({ title: expect.anything() }));
  });
});
