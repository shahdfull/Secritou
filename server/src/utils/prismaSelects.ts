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

// SEC-203: description (Text, potentially long) is never rendered by DocumentsPage.tsx's list
// view (grep confirmed: its only "description" matches are the create/edit form, not the list
// card) — a dedicated select for documentRepository.findAll only, distinct from the full row
// still returned by findById.
export const documentListSelect = {
  id: true,
  name: true,
  title: true,
  type: true,
  url: true,
  fileUrl: true,
  fileKey: true,
  version: true,
  parentId: true,
  tags: true,
  accessLevel: true,
  clientId: true,
  client: { select: { name: true } },
  projectId: true,
  taskId: true,
  invoiceId: true,
  uploadedById: true,
  signedAt: true,
  signedByClientId: true,
  createdAt: true,
  updatedAt: true,
} as const;

// SEC-203: description is never rendered by ProposalsPage.tsx (admin/manager list) — its dialogs
// (accept/reject/delete/invoice) reuse the already-fetched list item but none render description.
// Distinct from proposalRepository.findAllByClientId, which the client portal
// (ProposalsClientPage.tsx) uses for BOTH list and detail-in-place (no separate findById call) —
// description and sections[].content are genuinely displayed there, so that method keeps its
// full include and must not be narrowed the same way.
export const proposalListSelect = {
  id: true,
  title: true,
  status: true,
  version: true,
  amount: true,
  currency: true,
  expiresAt: true,
  viewedAt: true,
  acceptedAt: true,
  rejectedAt: true,
  pdfUrl: true,
  clientName: true,
  email: true,
  clientId: true,
  client: { select: { name: true } },
  projectId: true,
  serviceRequestId: true,
  leadId: true,
  invoice: { select: { id: true } },
  createdAt: true,
  updatedAt: true,
} as const;
