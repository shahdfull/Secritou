import { useState, useCallback, useMemo } from "react";

export interface ListFilters {
  search?: string;
  status?: string;
  [key: string]: unknown;
}

export function useListFilters(initialFilters: ListFilters = {}) {
  const [filters, setFilters] = useState<ListFilters>(initialFilters);

  const setSearch = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search }));
  }, []);

  const setStatus = useCallback((status: string | undefined) => {
    setFilters((prev) => ({ ...prev, status }));
  }, []);

  const setFilter = useCallback((key: string, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilter = useCallback((key: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters({});
  }, []);

  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some((value) => value !== undefined && value !== "");
  }, [filters]);

  return {
    filters,
    setSearch,
    setStatus,
    setFilter,
    clearFilter,
    clearAllFilters,
    hasActiveFilters,
  };
}
