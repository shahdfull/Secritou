export interface ListQueryOptions {
  page: number;
  pageSize: number;
  orderBy?: string;
  orderDir: "asc" | "desc";
  search?: string;
  status?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// SEC-118: the leads Kanban view sends pageSize: 200 to load its whole pipeline in one request
// (it groups leads into columns client-side, so it can't paginate per-column against this single
// endpoint) — the default 50 cap silently truncated any pipeline past 50 leads across ALL
// columns combined, with no error or indication to the user. maxPageSize lets a specific caller
// raise this ceiling deliberately (still capped, never unbounded) without loosening it for every
// other list endpoint that shares parseListQuery and has no such reason to.
export function parseListQuery(query: Record<string, unknown>, maxPageSize = 50): ListQueryOptions {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(maxPageSize, Math.max(1, Number(query.pageSize) || 10));
  const orderBy = typeof query.orderBy === "string" ? query.orderBy : undefined;
  const orderDir = query.orderDir === "desc" ? "desc" : "asc";
  const search =
    typeof query.search === "string" && query.search.trim().length > 0
      ? query.search.trim().slice(0, 200)
      : undefined;
  const status = typeof query.status === "string" && query.status.trim() ? query.status.trim() : undefined;
  return { page, pageSize, orderBy, orderDir, search, status };
}

export function buildOrderBy(
  orderBy: string | undefined,
  orderDir: "asc" | "desc",
  allowedFields: string[],
  defaultField: string
): Record<string, "asc" | "desc"> {
  const field = orderBy && allowedFields.includes(orderBy) ? orderBy : defaultField;
  return { [field]: orderDir };
}

export function buildTextSearchFilter(
  search: string | undefined,
  fields: string[]
): Record<string, unknown> {
  if (!search) return {};
  return {
    OR: fields.map((field) => ({
      [field]: { contains: search, mode: "insensitive" as const },
    })),
  };
}
