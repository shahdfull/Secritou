import { Prisma } from "@prisma/client";

export function sqlDateRange(column: string, from?: Date, to?: Date, table?: string) {
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
