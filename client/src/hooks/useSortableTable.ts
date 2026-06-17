import { useCallback, useState } from "react";

export interface SortState {
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export function useSortableTable(
  columns: string[],
  defaultSortBy = columns[0] ?? "createdAt"
) {
  const [sortBy, setSortBy] = useState(defaultSortBy);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const toggleSort = useCallback(
    (column: string) => {
      if (!columns.includes(column)) return;
      if (sortBy === column) {
        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortBy(column);
        setSortOrder("asc");
      }
    },
    [columns, sortBy]
  );

  return { sortBy, sortOrder, toggleSort, setSortBy, setSortOrder };
}
