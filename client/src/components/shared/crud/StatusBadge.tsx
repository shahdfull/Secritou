import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  // Task statuses
  TODO: { label: "À faire", className: "bg-gray-100 text-gray-800" },
  IN_PROGRESS: { label: "En cours", className: "bg-blue-100 text-blue-800" },
  REVIEW: { label: "En révision", className: "bg-yellow-100 text-yellow-800" },
  DONE: { label: "Terminé", className: "bg-green-100 text-green-800" },
  
  // Lead statuses
  NEW: { label: "Nouveau", className: "bg-blue-100 text-blue-800" },
  CONTACTED: { label: "Contacté", className: "bg-yellow-100 text-yellow-800" },
  QUALIFIED: { label: "Qualifié", className: "bg-purple-100 text-purple-800" },
  PROPOSAL: { label: "Proposition", className: "bg-pink-100 text-pink-800" },
  WON: { label: "Gagné", className: "bg-green-100 text-green-800" },
  LOST: { label: "Perdu", className: "bg-red-100 text-red-800" },
  
  // Mission statuses
  OPEN: { label: "Ouvert", className: "bg-green-100 text-green-800" },
  ASSIGNED: { label: "Assigné", className: "bg-purple-100 text-purple-800" },
  COMPLETED: { label: "Terminé", className: "bg-gray-100 text-gray-800" },
  CANCELLED: { label: "Annulé", className: "bg-red-100 text-red-800" },
  
  // Project statuses
  PLANNING: { label: "Planification", className: "bg-gray-100 text-gray-800" },
  
  // Application statuses
  PENDING: { label: "En attente", className: "bg-yellow-100 text-yellow-800" },
  ACCEPTED: { label: "Accepté", className: "bg-green-100 text-green-800" },
  REJECTED: { label: "Refusé", className: "bg-red-100 text-red-800" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || { label: status, className: "bg-gray-100 text-gray-800" };
  
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", config.className, className)}>
      {config.label}
    </span>
  );
}
