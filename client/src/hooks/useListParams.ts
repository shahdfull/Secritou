import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { ListQueryParams } from "@/types/pagination";

export function useListParams(defaultPageSize = 10) {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get("page")) || 1;
  const pageSize = Number(searchParams.get("pageSize")) || defaultPageSize;
  const orderBy = searchParams.get("orderBy") || undefined;
  const orderDir = (searchParams.get("orderDir") === "asc" ? "asc" : "desc") as "asc" | "desc";
  const search = searchParams.get("search") || undefined;
  const status = searchParams.get("status") || undefined;

  const params: ListQueryParams = useMemo(
    () => ({ page, pageSize, orderBy, orderDir, search, status }),
    [page, pageSize, orderBy, orderDir, search, status],
  );

  const updateParams = useCallback(
    (updates: Partial<ListQueryParams>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (updates.page !== undefined) next.set("page", String(updates.page));
        if (updates.pageSize !== undefined) next.set("pageSize", String(updates.pageSize));
        if (updates.orderBy !== undefined) {
          if (updates.orderBy) next.set("orderBy", updates.orderBy);
          else next.delete("orderBy");
        }
        if (updates.orderDir !== undefined) next.set("orderDir", updates.orderDir);
        if (updates.search !== undefined) {
          if (updates.search) next.set("search", updates.search);
          else next.delete("search");
        }
        if (updates.status !== undefined) {
          if (updates.status) next.set("status", updates.status);
          else next.delete("status");
        }
        return next;
      });
    },
    [setSearchParams],
  );

  const setPage = useCallback((newPage: number) => updateParams({ page: newPage }), [updateParams]);

  const setSearch = useCallback(
    (value: string) => updateParams({ search: value || undefined, page: 1 }),
    [updateParams],
  );

  const setSort = useCallback(
    (column: string, currentSortBy: string, currentSortOrder: "asc" | "desc") => {
      if (currentSortBy === column) {
        updateParams({ orderBy: column, orderDir: currentSortOrder === "asc" ? "desc" : "asc", page: 1 });
      } else {
        updateParams({ orderBy: column, orderDir: "asc", page: 1 });
      }
    },
    [updateParams],
  );

  return { page, pageSize, orderBy, orderDir, search, status, params, setPage, setSearch, setSort, updateParams };
}
