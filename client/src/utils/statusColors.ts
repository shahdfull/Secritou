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
