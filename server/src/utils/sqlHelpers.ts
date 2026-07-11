import { Prisma } from "@prisma/client";

// Validates that a value is a safe SQL identifier (letters, digits, underscores only).
// Prevents injection if a caller accidentally passes user-controlled input.
function assertSafeIdentifier(value: string, label: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`[sqlHelpers] Unsafe SQL identifier for ${label}: "${value}"`);
  }
}

export function sqlDateRange(column: string, from?: Date, to?: Date, table?: string) {
  assertSafeIdentifier(column, "column");
  if (table) assertSafeIdentifier(table, "table");
  const col = table
    ? Prisma.raw(`"${table}"."${column}"`)
    : Prisma.raw(`"${column}"`);
  if (from && to) {
    return Prisma.sql`AND ${col} >= ${from} AND ${col} <= ${to}`;
  }
  if (from) {
    return Prisma.sql`AND ${col} >= ${from}`;
  }
  if (to) {
    return Prisma.sql`AND ${col} <= ${to}`;
  }
  return Prisma.empty;
}
