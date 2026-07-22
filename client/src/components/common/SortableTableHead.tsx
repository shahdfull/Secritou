import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface SortableTableHeadProps {
  column: string;
  label: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSort: (column: string) => void;
  className?: string;
}

export function SortableTableHead({
  column,
  label,
  sortBy,
  sortOrder,
  onSort,
  className,
}: SortableTableHeadProps) {
  const isActive = sortBy === column;

  return (
    <TableHead
      className={cn("select-none", className)}
      aria-sort={isActive ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
    >
      {/* A shared component reused by every sortable list column across the app (LeadsPage,
          TasksListView, ...) — was a plain <div onClick>, invisible to keyboard/screen-reader
          users (no role, no tabIndex, no key handler, no accessible name for the sort state).
          A real <button> fixes all four for every consumer at once. */}
      <button
        type="button"
        onClick={() => onSort(column)}
        className="flex items-center gap-1 cursor-pointer hover:text-foreground"
        aria-label={`Trier par ${label}${isActive ? (sortOrder === "asc" ? ", ordre croissant" : ", ordre décroissant") : ""}`}
      >
        {label}
        {isActive ? (
          sortOrder === "asc" ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )
        ) : (
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
    </TableHead>
  );
}
