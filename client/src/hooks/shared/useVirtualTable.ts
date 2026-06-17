import { useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

export interface UseVirtualTableOptions {
  count: number;
  estimateSize?: number;
  overscan?: number;
}

export function useVirtualTable(options: UseVirtualTableOptions) {
  const { count, estimateSize = 56, overscan = 12 } = options;
  const parentRef = useRef<HTMLDivElement | null>(null);

  const rowVirtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  return {
    parentRef,
    virtualRows,
    totalSize,
    rowVirtualizer,
  };
}
