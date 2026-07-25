import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
} from "ag-grid-community";
import { formatDate } from "@/utils/format";
import {
  useCommissions,
  useCommissionsOwedSummary,
  useMarkCommissionPaid,
  useMyCommissions,
  useMyCommissionsOwedSummary,
} from "@/hooks/useCommissions";
import type { Commission } from "@/api/commissions.api";
import { useListParams } from "@/hooks/useListParams";
import { usersApi } from "@/api/users.api";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { DataTablePagination } from "@/components/common/DataTablePagination";

ModuleRegistry.registerModules([AllCommunityModule]);

// Cohérent avec la migration AG Grid de TasksListView.tsx (mêmes tokens, thème clair unique).
const gridTheme = themeQuartz.withParams({
  accentColor: "#0f766e",
  headerBackgroundColor: "#f8fafc",
  headerTextColor: "#334155",
  rowHoverColor: "#f1f5f9",
  borderColor: "#e2e8f0",
  fontFamily: "inherit",
});

const ALL_STATUSES_VALUE = "__all__";

export function CommissionsPage() {
  const { t } = useTranslation();
  const { page, pageSize, status, updateParams } = useListParams(10);
  const role = useAuthStore((state) => state.user?.role);
  const isManager = role === "MANAGER";

  // MANAGER sees only their own commissions (server enforces this regardless — see
  // /commissions/my — but we also swap the query so we don't fetch data they can't have).
  const adminSummaryQuery = useCommissionsOwedSummary(!isManager);
  const myOwedSummaryQuery = useMyCommissionsOwedSummary(isManager);
  const adminCommissionsQuery = useCommissions({ page, pageSize, status }, !isManager);
  const myCommissionsQuery = useMyCommissions({ page, pageSize, status }, isManager);

  const { data: summary, isLoading: summaryLoading } = isManager
    ? { data: myOwedSummaryQuery.data ? [myOwedSummaryQuery.data] : undefined, isLoading: myOwedSummaryQuery.isLoading }
    : adminSummaryQuery;
  const { data: commissionsResult, isLoading } = isManager ? myCommissionsQuery : adminCommissionsQuery;
  const markPaidMutation = useMarkCommissionPaid();

  // Commission rows only carry partnerId in the summary; resolve names client-side
  // from the (small, ADMIN+MANAGER-sized) user list rather than adding a join server-side.
  const { data: usersResult } = useQuery({
    queryKey: ["users", "forCommissions"],
    queryFn: () => usersApi.getUsers({ page: 1, pageSize: 200 }),
    staleTime: 5 * 60_000,
    enabled: !isManager,
  });
  const partnerNameById = useMemo(() => {
    const map = new Map<string, string>();
    (usersResult?.data ?? []).forEach((u) => map.set(u.id, u.name));
    return map;
  }, [usersResult?.data]);

  const commissions = useMemo(
    () => Array.isArray(commissionsResult?.data) ? commissionsResult.data : [],
    [commissionsResult?.data]
  );

  const statusRenderer = useCallback(
    (params: ICellRendererParams<Commission>) => {
      const c = params.data;
      if (!c) return null;
      return (
        <div className="flex h-full items-center gap-2 min-w-0" title={c.status === "PAID" && c.paidAt ? formatDate(c.paidAt) : undefined}>
          <Badge className={(c.status === "PAID" ? "bg-green-100 text-green-800" : "bg-accent-soft text-accent-strong") + " shrink-0"}>
            {t(`commissions.statuses.${c.status.toLowerCase()}`)}
          </Badge>
          {c.status === "PAID" && c.paidAt && (
            <span className="text-xs text-muted-foreground truncate">{formatDate(c.paidAt)}</span>
          )}
        </div>
      );
    },
    [t]
  );

  const actionsRenderer = useCallback(
    (params: ICellRendererParams<Commission>) => {
      const c = params.data;
      if (!c) return null;
      const isPending = c.status === "PENDING";
      return (
        <div className="flex h-full items-center justify-end">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-green-600 hover:bg-green-50 disabled:text-muted-foreground"
            title={isPending ? t("commissions.markPaid", "Marquer comme payée") : t("commissions.alreadyPaid", "Déjà payée")}
            onClick={() => markPaidMutation.mutate(c.id)}
            disabled={!isPending || markPaidMutation.isPending}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      );
    },
    [t, markPaidMutation]
  );

  const columnDefs = useMemo<ColDef<Commission>[]>(() => {
    const cols: ColDef<Commission>[] = [];
    if (!isManager) {
      cols.push({
        headerName: t("commissions.partner", "Associé"),
        valueGetter: (p) => p.data?.partner?.name ?? p.data?.partnerId.slice(0, 8),
        flex: 1,
        cellClass: "font-medium",
      });
    }
    cols.push(
      { headerName: t("commissions.project", "Projet"), valueGetter: (p) => p.data?.project?.name ?? p.data?.projectId.slice(0, 8), flex: 1 },
      { headerName: t("commissions.invoice", "Facture"), valueGetter: (p) => p.data?.invoice?.number ?? p.data?.invoiceId.slice(0, 8), flex: 1 },
      { headerName: t("commissions.basis", "Montant encaissé"), valueFormatter: (p) => p.data!.basis.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }), field: "basis", flex: 1 },
      { headerName: t("commissions.rate", "Taux"), valueFormatter: (p) => `${p.data!.ratePct}%`, field: "ratePct", width: 100 },
      { headerName: t("commissions.amount", "Montant dû"), valueFormatter: (p) => p.data!.amount.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }), field: "amount", flex: 1, cellClass: "font-medium" },
      { headerName: t("commissions.status", "Statut"), cellRenderer: statusRenderer, flex: 1.4, minWidth: 160 }
    );
    if (!isManager) {
      cols.push({ headerName: t("commissions.actions", "Actions"), cellRenderer: actionsRenderer, width: 90, sortable: false, resizable: false });
    }
    return cols;
  }, [t, isManager, statusRenderer, actionsRenderer]);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">
          {isManager ? t("commissions.myTitle", "Mes commissions") : t("commissions.title", "Commissions associés")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isManager
            ? t("commissions.mySubtitle", "Ce qui vous est dû, calculé au paiement encaissé sur vos projets.")
            : t("commissions.subtitle", "Ce qui est dû à chaque associé, calculé au paiement encaissé sur chaque projet.")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {summaryLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : !summary || summary.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("commissions.noSplitsYet", "Aucune répartition de commission configurée pour le moment.")}</p>
        ) : (
          summary.map((row) => (
            <Card key={row.partnerId}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {partnerNameById.get(row.partnerId) ?? `${t("commissions.partnerId", "Associé")} ${row.partnerId.slice(0, 8)}`}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-2xl font-bold text-ink">{row.pending.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</p>
                <p className="text-xs text-muted-foreground">{t("commissions.pendingLabel", "à verser")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("commissions.paidLabel", "déjà versé")} : {row.paid.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <Select
          value={status || ALL_STATUSES_VALUE}
          onValueChange={(value) => updateParams({ status: value === ALL_STATUSES_VALUE ? undefined : value, page: 1 })}
        >
          <SelectTrigger className="max-w-sm">
            <SelectValue placeholder={t("commissions.filterByStatus", "Filtrer par statut")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES_VALUE}>{t("commissions.allStatuses", "Tous les statuts")}</SelectItem>
            <SelectItem value="PENDING">{t("commissions.statuses.pending", "À verser")}</SelectItem>
            <SelectItem value="PAID">{t("commissions.statuses.paid", "Payée")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-hidden" style={{ height: 500 }}>
        <AgGridReact<Commission>
          theme={gridTheme}
          rowData={commissions}
          columnDefs={columnDefs}
          loading={isLoading}
          suppressCellFocus
          overlayLoadingTemplate={t("common.loading")}
          overlayNoRowsTemplate={t("commissions.empty", "Aucune commission pour le moment.")}
        />
      </div>

      {commissionsResult && Number.isFinite(commissionsResult.total) && (
        <DataTablePagination
          page={commissionsResult.page}
          pageSize={commissionsResult.pageSize}
          total={commissionsResult.total}
          onPageChange={(newPage) => updateParams({ page: newPage })}
        />
      )}
    </section>
  );
}
