export interface ListQueryParams {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: "asc" | "desc";
  search?: string;
  status?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function buildListQueryString(params: ListQueryParams): string {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  if (params.orderBy) search.set("orderBy", params.orderBy);
  if (params.orderDir) search.set("orderDir", params.orderDir);
  if (params.search) search.set("search", params.search);
  if (params.status) search.set("status", params.status);
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}
