import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/utils/format";
import {
  useCommissions,
  useCommissionsOwedSummary,
  useMarkCommissionPaid,
  useMyCommissions,
  useMyCommissionsOwedSummary,
} from "@/hooks/useCommissions";
import { useListParams } from "@/hooks/useListParams";
import { usersApi } from "@/api/users.api";
import { useAuthStore } from "@/store/auth.store";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {!isManager && <TableHead>{t("commissions.partner", "Associé")}</TableHead>}
              <TableHead>{t("commissions.project", "Projet")}</TableHead>
              <TableHead>{t("commissions.invoice", "Facture")}</TableHead>
              <TableHead>{t("commissions.basis", "Montant encaissé")}</TableHead>
              <TableHead>{t("commissions.rate", "Taux")}</TableHead>
              <TableHead>{t("commissions.amount", "Montant dû")}</TableHead>
              <TableHead>{t("commissions.status", "Statut")}</TableHead>
              {!isManager && <TableHead className="text-right">{t("commissions.actions", "Actions")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isManager ? 6 : 8} className="text-center py-10">{t("common.loading")}</TableCell>
              </TableRow>
            ) : commissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isManager ? 6 : 8} className="text-center py-10">{t("commissions.empty", "Aucune commission pour le moment.")}</TableCell>
              </TableRow>
            ) : (
              commissions.map((c) => (
                <TableRow key={c.id}>
                  {!isManager && <TableCell className="font-medium">{c.partner?.name ?? c.partnerId.slice(0, 8)}</TableCell>}
                  <TableCell>{c.project?.name ?? c.projectId.slice(0, 8)}</TableCell>
                  <TableCell>{c.invoice?.number ?? c.invoiceId.slice(0, 8)}</TableCell>
                  <TableCell>{c.basis.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</TableCell>
                  <TableCell>{c.ratePct}%</TableCell>
                  <TableCell className="font-medium">{c.amount.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</TableCell>
                  <TableCell>
                    <Badge className={c.status === "PAID" ? "bg-green-100 text-green-800" : "bg-accent-soft text-accent-strong"}>
                      {t(`commissions.statuses.${c.status.toLowerCase()}`)}
                    </Badge>
                    {c.status === "PAID" && c.paidAt && (
                      <span className="ml-2 text-xs text-muted-foreground">{formatDate(c.paidAt)}</span>
                    )}
                  </TableCell>
                  {!isManager && (
                    <TableCell className="text-right">
                      {c.status === "PENDING" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-green-600 hover:bg-green-50"
                          title={t("commissions.markPaid", "Marquer comme payée")}
                          onClick={() => markPaidMutation.mutate(c.id)}
                          disabled={markPaidMutation.isPending}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
