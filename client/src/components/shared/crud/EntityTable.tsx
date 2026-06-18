import { type ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useVirtualTable } from "@/hooks/shared/useVirtualTable";
import { EmptyState } from "./EmptyState";
import { LoadingState } from "./LoadingState";

interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => ReactNode;
}

interface EntityTableProps<T> {
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  onRowClick?: (row: T) => void;
  rowKey: keyof T | ((row: T) => string);
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  virtual?: boolean;
  renderActions?: (row: T) => ReactNode;
}

export function EntityTable<T extends Record<string, unknown>>({
  data,
  columns,
  isLoading = false,
  onRowClick,
  rowKey,
  emptyStateTitle = "Aucune donnée",
  emptyStateDescription,
  virtual = false,
  renderActions,
}: EntityTableProps<T>) {
  const { parentRef, virtualRows, totalSize } = useVirtualTable({
    count: data.length,
    estimateSize: 56,
  });

  if (isLoading) {
    return <LoadingState />;
  }

  if (data.length === 0) {
    return <EmptyState title={emptyStateTitle} description={emptyStateDescription} />;
  }

  const getRowKey = (row: T): string => {
    if (typeof rowKey === "function") {
      return rowKey(row);
    }
    return String(row[rowKey]);
  };

  if (virtual) {
    return (
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={String(column.key)}>{column.label}</TableHead>
              ))}
              {renderActions && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
        </Table>
        <div
          ref={parentRef}
          className="max-h-[65vh] overflow-auto border-t"
          style={{ contentVisibility: "auto" } as React.CSSProperties}
        >
          <div style={{ height: totalSize, position: "relative" }}>
            {virtualRows.map((virtualRow) => {
              const row = data[virtualRow.index];
              if (!row) return null;

              return (
                <div
                  key={getRowKey(row)}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => onRowClick?.(row)}>
                    <div className="grid grid-cols-1 px-4 h-14 items-center">
                      {columns.map((column) => (
                        <div key={String(column.key)} className="truncate">
                          {column.render ? column.render(row[column.key as keyof T], row) : String(row[column.key as keyof T] ?? "-")}
                        </div>
                      ))}
                      {renderActions && <div className="flex justify-end">{renderActions(row)}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={String(column.key)}>{column.label}</TableHead>
            ))}
            {renderActions && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow
              key={getRowKey(row)}
              onClick={() => onRowClick?.(row)}
              className={onRowClick ? "cursor-pointer" : ""}
            >
              {columns.map((column) => (
                <TableCell key={String(column.key)}>
                  {column.render ? column.render(row[column.key as keyof T], row) : String(row[column.key as keyof T] ?? "-")}
                </TableCell>
              ))}
              {renderActions && <TableCell className="text-right">{renderActions(row)}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
