export const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL: "Proposal",
  WON: "Converted",
  LOST: "Lost",
};

export const LEAD_STATUS_BADGE: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800",
  CONTACTED: "bg-yellow-100 text-yellow-800",
  QUALIFIED: "bg-purple-100 text-purple-800",
  PROPOSAL: "bg-orange-100 text-orange-800",
  WON: "bg-green-100 text-green-800",
  LOST: "bg-red-100 text-red-800",
};

export const LEAD_STATUS_CHART_COLOR: Record<string, string> = {
  NEW: "#6797A4",
  CONTACTED: "#E1B4AC",
  QUALIFIED: "#8ab4c0",
  PROPOSAL: "#c8938b",
  WON: "#4caf8a",
  LOST: "#d4908a",
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  // Shared semantic colors:
  // - neutral: draft / pending
  // - info: sent / viewed / commented
  // - success: accepted / approved / completed / paid
  // - warning: in progress / partial / overdue / waiting
  // - danger: rejected / cancelled / expired
  DRAFT: "bg-muted text-muted-foreground",
  NEW: "bg-blue-100 text-blue-800",
  SENT: "bg-primary-soft text-primary-strong",
  VIEWED: "bg-primary-soft text-primary-strong",
  PENDING: "bg-yellow-100 text-yellow-700",
  IN_REVIEW: "bg-purple-100 text-purple-800",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  WAITING_CLIENT: "bg-orange-100 text-orange-800",
  COMMENTED: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-green-100 text-green-800",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  EXPIRED: "bg-accent-soft text-accent-strong",
  PAID: "bg-green-100 text-green-700",
  UNPAID: "bg-red-100 text-red-700",
  PARTIAL: "bg-yellow-100 text-yellow-700",
  OVERDUE: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500 line-through",
  COMPLETED: "bg-green-100 text-green-800",
  SIGNED: "bg-green-100 text-green-700",
};

export function getLeadStatusBadgeClass(status: string): string {
  return LEAD_STATUS_BADGE[status] ?? "bg-gray-100 text-gray-800";
}

export function getProjectStatusBadgeClass(status: string): string {
  switch (status) {
    case "PLANNING":
      return "bg-surface-warm text-ink/70";
    case "IN_PROGRESS":
      return "bg-primary-soft text-primary-strong font-medium";
    case "REVIEW":
      return "bg-accent-soft text-accent-foreground font-medium";
    case "COMPLETED":
      return "bg-green-100 text-green-800";
    default:
      return "bg-surface-warm text-ink/70";
  }
}

export function getTaskStatusBadgeClass(status: string): string {
  switch (status) {
    case "TODO":
      return "bg-surface-warm text-ink/70";
    case "IN_PROGRESS":
      return "bg-primary-soft text-primary-strong font-medium";
    case "REVIEW":
      return "bg-accent-soft text-accent-foreground font-medium";
    case "DONE":
      return "bg-green-100 text-green-800";
    default:
      return "bg-surface-warm text-ink/70";
  }
}

export function getProposalStatusBadgeClass(status: string): string {
  return STATUS_BADGE_CLASSES[status] ?? "bg-gray-100 text-gray-700";
}

export function getInvoiceStatusBadgeClass(status: string): string {
  return STATUS_BADGE_CLASSES[status] ?? "bg-gray-100 text-gray-700";
}

export function getServiceRequestStatusBadgeClass(status: string): string {
  return STATUS_BADGE_CLASSES[status] ?? "bg-gray-100 text-gray-800";
}

export function getApprovalStatusBadgeClass(status: string): string {
  return STATUS_BADGE_CLASSES[status] ?? "bg-gray-100 text-gray-700";
}

// Covers OnboardingStepStatus, ContractStatus, OnboardingPaymentStatus and
// SpecApprovalStatus — they're distinct enums but share the same semantic
// vocabulary (pending/in-progress/paid/approved/rejected/signed...), so one
// palette lookup is enough rather than one map per enum.
export function getOnboardingStatusBadgeClass(status: string): string {
  return STATUS_BADGE_CLASSES[status] ?? "bg-gray-100 text-gray-700";
}

// CreditNote has no status enum server-side (applied/available is derived from
// `appliedAt` being set), so it can't key off STATUS_BADGE_CLASSES like the others —
// same semantic colors (green=resolved/applied, yellow=pending/available) applied directly.
export function getCreditNoteBadgeClass(isApplied: boolean): string {
  return isApplied ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700";
}