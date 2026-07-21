import { AxiosError } from "axios";

// SEC-095: several mutations across the Project/Task module had no onError at all, or only the
// mutation hook's generic fallback — a rejection carrying a real server message (e.g. 409
// PROJECT_ARCHIVED after SEC-089) never reached the user. This mirrors the pattern already
// established in TasksKanban.tsx#handleDragEnd: prefer the server's actual message when present,
// since it's more specific than any client-side guess about why the request failed.
export function getServerErrorMessage(error: unknown): string | undefined {
  if (!(error instanceof AxiosError)) return undefined;
  return (error.response?.data as { error?: { message?: string } } | undefined)?.error?.message;
}

export function getServerRequestId(error: unknown): string | undefined {
  if (!(error instanceof AxiosError)) return undefined;

  const headers = error.response?.headers as Record<string, string | undefined> | undefined;
  const data = error.response?.data as { requestId?: string } | undefined;

  return data?.requestId ?? headers?.["x-request-id"] ?? headers?.["x-request-id".toLowerCase()];
}
