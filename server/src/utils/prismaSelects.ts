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

export const authorPublicSelect = {
  id: true,
  name: true,
  email: true,
} as const;
