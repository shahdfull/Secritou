export const userPublicSelect = {
  id: true,
  name: true,
  email: true,
} as const;

export const clientBriefSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
} as const;

export const projectBriefSelect = {
  id: true,
  name: true,
  status: true,
} as const;

export const taskWithRelationsSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  startDate: true,
  dueDate: true,
  projectId: true,
  assigneeId: true,
  createdAt: true,
  updatedAt: true,
  project: { select: projectBriefSelect },
  assignee: { select: userPublicSelect },
} as const;

// SEC-171: description (Text, potentially long) is never rendered by any list/Kanban view
// (grep confirmed: TaskDetailDrawer.tsx is the sole consumer) — a dedicated select for
// taskRepository.findAll only, distinct from taskWithRelationsSelect which stays unchanged for
// findById/create/update/delete (their callers expect a full task back, e.g. right after a
// mutation, without a second round-trip).
export const taskListSelect = {
  id: true,
  title: true,
  status: true,
  priority: true,
  startDate: true,
  dueDate: true,
  projectId: true,
  assigneeId: true,
  createdAt: true,
  updatedAt: true,
  project: { select: projectBriefSelect },
  assignee: { select: userPublicSelect },
} as const;

export const authorPublicSelect = {
  id: true,
  name: true,
  email: true,
} as const;
