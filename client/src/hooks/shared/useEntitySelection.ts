import { useCallback, useMemo, useState } from "react";

export function useEntitySelection<T extends string | number>(initialSelected: Set<T> = new Set()) {
  const [selected, setSelected] = useState<Set<T>>(initialSelected);

  const toggle = useCallback((id: T) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: T[]) => {
    setSelected(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  const selectedCount = selected.size;
  const isAllSelected = useMemo(() => selectedCount > 0, [selectedCount]);
  const isSelected = useCallback((id: T) => selected.has(id), [selected]);

  return {
    selected,
    selectedCount,
    isAllSelected,
    toggle,
    selectAll,
    clearSelection,
    isSelected,
  };
}
