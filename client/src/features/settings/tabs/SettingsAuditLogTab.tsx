import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AgGridReact } from "ag-grid-react";
import "@/lib/agGridModules";
import { gridTheme } from "@/lib/agGridTheme";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTablePagination } from "@/components/common/DataTablePagination";
import { useListParams } from "@/hooks/useListParams";
import { useDebouncedValue } from "@/hooks/shared/useDebouncedValue";
import { useAuditLog, useAuditLogEntityTypes } from "@/hooks/useAuditLog";
import type { AuditLogEntry } from "@/api/auditLog.api";
import { formatDateTime } from "@/utils/format";
import { Eye, Loader2 } from "lucide-react";

const ALL_VALUE = "__all__";

function ActorCell({ entry }: { entry: AuditLogEntry }) {
  const { t } = useTranslation();
  if (!entry.actorId) {
    return <span className="text-muted-foreground italic">{t("auditLog.systemActor")}</span>;
  }
  return (
    <div className="min-w-0">
      <p className="truncate text-sm">{entry.actorName ?? entry.actorId}</p>
      {entry.actorRole && (
        <Badge variant="outline" className="text-[10px]">
          {entry.actorRole}
        </Badge>
      )}
    </div>
  );
}

// SEC-114: the read-only audit trail — first consumer of AuditLog, written since well before
// this tab existed by 9 services (task/project/invoice/gdpr/creditNote/approval/user/
// managerPermission, plus a cron-driven invoice transition). ADMIN-only, same gating pattern as
// SettingsUsersTab's own tab — enforced again server-side (auditLog.routes.ts), this component
// never being mounted for a non-ADMIN role is a UX courtesy, not the real authorization boundary.
export function SettingsAuditLogTab() {
  const { t } = useTranslation();
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>(ALL_VALUE);
  const [entityIdInput, setEntityIdInput] = useState("");
  const [detailEntry, setDetailEntry] = useState<AuditLogEntry | null>(null);

  const { page, pageSize, orderBy, orderDir, setPage, updateParams } = useListParams(20);
  const debouncedEntityId = useDebouncedValue(entityIdInput, 300);

  const { data: entityTypes = [] } = useAuditLogEntityTypes();

  const listParams = useMemo(
    () => ({
      page,
      pageSize,
      orderBy: orderBy ?? "createdAt",
      orderDir,
      entityType: entityTypeFilter === ALL_VALUE ? undefined : entityTypeFilter,
      entityId: debouncedEntityId.trim() || undefined,
    }),
    [page, pageSize, orderBy, orderDir, entityTypeFilter, debouncedEntityId],
  );

  const { data: result, isLoading, isError } = useAuditLog(listParams);
  const entries = result?.data ?? [];
  const total = result?.total ?? 0;

  const detailRenderer = (props: ICellRendererParams<AuditLogEntry>) => (
    <Button variant="ghost" size="sm" className="h-7 gap-1.5" onClick={() => setDetailEntry(props.data!)}>
      <Eye className="h-3.5 w-3.5" />
      {t("auditLog.viewDetail")}
    </Button>
  );

  const columnDefs = useMemo<ColDef<AuditLogEntry>[]>(
    () => [
      {
        headerName: t("auditLog.columns.createdAt"),
        field: "createdAt",
        valueFormatter: (p) => formatDateTime(p.data!.createdAt),
        flex: 1,
        minWidth: 150,
      },
      {
        headerName: t("auditLog.columns.actor"),
        cellRenderer: (p: ICellRendererParams<AuditLogEntry>) => <ActorCell entry={p.data!} />,
        flex: 1.2,
        minWidth: 160,
        sortable: false,
      },
      { headerName: t("auditLog.columns.action"), field: "action", flex: 1, minWidth: 140 },
      { headerName: t("auditLog.columns.entityType"), field: "entityType", flex: 0.8, minWidth: 120 },
      { headerName: t("auditLog.columns.entityId"), field: "entityId", flex: 1, minWidth: 160 },
      {
        headerName: t("auditLog.columns.detail"),
        cellRenderer: detailRenderer,
        flex: 0.7,
        minWidth: 100,
        sortable: false,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  );

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t("auditLog.filters.entityType")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>{t("auditLog.filters.allEntityTypes")}</SelectItem>
              {entityTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder={t("auditLog.filters.entityId")}
            value={entityIdInput}
            onChange={(e) => {
              setEntityIdInput(e.target.value);
              updateParams({ page: 1 });
            }}
            className="w-64"
          />
        </div>

        {isError ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t("common.error")}</p>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div style={{ height: 480, width: "100%" }}>
              <AgGridReact<AuditLogEntry>
                theme={gridTheme}
                rowData={entries}
                columnDefs={columnDefs}
                getRowId={(p) => p.data.id}
                domLayout="normal"
                suppressCellFocus
              />
            </div>
            <DataTablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
          </>
        )}
      </CardContent>

      <Dialog open={!!detailEntry} onOpenChange={(open) => !open && setDetailEntry(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {detailEntry?.action} — {detailEntry?.entityType}
            </DialogTitle>
            <DialogDescription>
              {detailEntry && formatDateTime(detailEntry.createdAt)}
            </DialogDescription>
          </DialogHeader>
          {detailEntry && (
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-medium text-muted-foreground">{t("auditLog.columns.entityId")}</p>
                <p className="font-mono text-xs">{detailEntry.entityId}</p>
              </div>
              {detailEntry.before !== null && detailEntry.before !== undefined && (
                <div>
                  <p className="font-medium text-muted-foreground">{t("auditLog.detail.before")}</p>
                  <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
                    {JSON.stringify(detailEntry.before, null, 2)}
                  </pre>
                </div>
              )}
              {detailEntry.after !== null && detailEntry.after !== undefined && (
                <div>
                  <p className="font-medium text-muted-foreground">{t("auditLog.detail.after")}</p>
                  <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
                    {JSON.stringify(detailEntry.after, null, 2)}
                  </pre>
                </div>
              )}
              {detailEntry.ipAddress && (
                <div>
                  <p className="font-medium text-muted-foreground">{t("auditLog.detail.ipAddress")}</p>
                  <p className="font-mono text-xs">{detailEntry.ipAddress}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
