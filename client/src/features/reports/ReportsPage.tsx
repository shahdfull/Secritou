import { useCallback, useMemo, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { formatCurrency } from "@/utils/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateFilter, DateRange } from "@/components/DateFilter";
import { useLeads } from "@/hooks/useLeads";
import { useProjects } from "@/hooks/useProjects";
import { useInvoices } from "@/hooks/useInvoices";
import { FileText, FileSpreadsheet, Loader2, Users, Briefcase, TrendingUp } from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry, AllCommunityModule, themeQuartz, type ColDef } from "ag-grid-community";
import type { Lead } from "@/types/lead";
import type { Project } from "@/types/project";
import type { Invoice } from "@/api/invoices.api";
import type { TFunction } from "i18next";

const formatStatus = (status: string, t: TFunction): string =>
  t(`reportsPage.statuses.${status}`, status);

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

export function ReportsPage() {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    return { from: thirtyDaysAgo, to: today };
  });

  const listParams = useMemo(() => ({ page: 1, pageSize: 500, orderBy: "createdAt", orderDir: "desc" as const }), []);
  const { data: leadsResult, isLoading: leadsLoading } = useLeads(listParams);
  const { data: projectsResult, isLoading: projectsLoading } = useProjects(listParams);
  const { data: invoicesResult, isLoading: invoicesLoading } = useInvoices(listParams);
  const leads = useMemo(() => leadsResult?.data ?? [], [leadsResult?.data]);
  const projects = useMemo(() => projectsResult?.data ?? [], [projectsResult?.data]);
  const invoices = useMemo(() => invoicesResult?.data ?? [], [invoicesResult?.data]);

  const isLoading = leadsLoading || projectsLoading || invoicesLoading;
  const [isExporting, startExportTransition] = useTransition();

  const fromMs = dateRange.from ? dateRange.from.getTime() : null;
  const toMs = dateRange.to ? dateRange.to.getTime() : null;

  const filteredLeads = useMemo(
    () =>
      leads.filter((lead) => {
        const createdAtMs = new Date(lead.createdAt).getTime();
        return (fromMs == null || createdAtMs >= fromMs) && (toMs == null || createdAtMs <= toMs);
      }),
    [leads, fromMs, toMs]
  );

  const leadConversionRate = useMemo(() => {
    const total = filteredLeads.length;
    if (!total) return 0;
    const won = filteredLeads.reduce((acc, l) => (l.status === "WON" ? acc + 1 : acc), 0);
    return Math.round((won / total) * 100);
  }, [filteredLeads]);

  const filteredProjects = useMemo(
    () =>
      projects.filter((project) => {
        const createdAtMs = new Date(project.createdAt).getTime();
        return (fromMs == null || createdAtMs >= fromMs) && (toMs == null || createdAtMs <= toMs);
      }),
    [projects, fromMs, toMs]
  );

  const avgProjectCompletionRate = useMemo(() => {
    const total = filteredProjects.length;
    if (!total) return 0;
    const completed = filteredProjects.reduce((acc, p) => (p.status === "COMPLETED" ? acc + 1 : acc), 0);
    return Math.round((completed / total) * 100);
  }, [filteredProjects]);

  // True revenue: cash actually received from paid/partial invoices within the date range.
  // Uses paidAt as recognition date to match analytics.repository.ts logic.
  const filteredInvoices = useMemo(
    () =>
      invoices.filter((inv) => {
        if (inv.status !== "PAID" && inv.status !== "PARTIAL") return false;
        const paidAtMs = inv.paidAt ? new Date(inv.paidAt).getTime() : null;
        if (paidAtMs == null) return false;
        return (fromMs == null || paidAtMs >= fromMs) && (toMs == null || paidAtMs <= toMs);
      }),
    [invoices, fromMs, toMs]
  );

  const totalRevenue = useMemo(
    () =>
      filteredInvoices.reduce((sum, inv) => {
        const received = inv.status === "PAID" ? Number(inv.amount) : Number(inv.amountPaid);
        return sum + received;
      }, 0),
    [filteredInvoices]
  );

  const exportToPDF = useCallback(() => {
    startExportTransition(async () => {
      try {
        const { exportReportsPdf } = await import("./exportPdf");
        await exportReportsPdf({
          dateRange,
          leads: filteredLeads,
          projects: filteredProjects,
        });
      } catch {
        toast.error(t("reportsPage.exportPdfError", "Échec de l'export PDF. Veuillez réessayer."));
      }
    });
  }, [dateRange, filteredLeads, filteredProjects, startExportTransition, t]);

  const exportToExcel = useCallback(() => {
    startExportTransition(async () => {
      try {
        const { exportReportsExcel } = await import("./exportExcel");
        await exportReportsExcel({
          leads: filteredLeads,
          projects: filteredProjects,
        });
      } catch {
        toast.error(t("reportsPage.exportExcelError", "Échec de l'export Excel. Veuillez réessayer."));
      }
    });
  }, [filteredLeads, filteredProjects, startExportTransition, t]);

  const leadColumnDefs = useMemo<ColDef<Lead>[]>(
    () => [
      { headerName: "Nom", field: "name", flex: 1, cellClass: "truncate" },
      { headerName: "Statut", valueFormatter: (p) => formatStatus(p.data!.status, t), field: "status", flex: 1 },
    ],
    [t]
  );

  const projectColumnDefs = useMemo<ColDef<Project>[]>(
    () => [
      { headerName: "Nom", field: "name", flex: 1, cellClass: "truncate" },
      { headerName: "Statut", valueFormatter: (p) => formatStatus(p.data!.status, t), field: "status", flex: 1 },
    ],
    [t]
  );

  const invoiceColumnDefs = useMemo<ColDef<Invoice>[]>(
    () => [
      { headerName: "Facture", valueGetter: (p) => `${p.data?.number} : ${p.data?.title}`, flex: 2, cellClass: "text-sm truncate" },
      {
        headerName: "Montant",
        valueFormatter: (p) => formatCurrency(p.data!.status === "PAID" ? Number(p.data!.amount) : Number(p.data!.amountPaid)),
        field: "amount",
        flex: 1,
        cellClass: "text-sm font-medium text-ink",
      },
    ],
    []
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Rapports</h1>
          <p className="text-muted-foreground">Visualiser et exporter les rapports d'activite</p>
        </div>
        <div className="flex gap-2">
          <DateFilter value={dateRange} onChange={setDateRange} />
          <Button onClick={exportToPDF} variant="outline" disabled={isExporting}>
            <FileText className="h-4 w-4 mr-2" />
            {isExporting ? "Export..." : "Exporter PDF"}
          </Button>
          <Button onClick={exportToExcel} disabled={isExporting}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            {isExporting ? "Export..." : "Exporter Excel"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Rapport Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-4">
              <div className="text-2xl font-bold">{filteredLeads.length}</div>
              <div className="text-3xl font-bold text-primary">{leadConversionRate}%</div>
            </div>
            <CardDescription className="text-sm text-muted-foreground">Taux de conversion</CardDescription>
          </CardContent>
          <CardContent>
            <div style={{ height: 300 }}>
              <AgGridReact<Lead>
                theme={gridTheme}
                rowData={filteredLeads}
                columnDefs={leadColumnDefs}
                suppressCellFocus
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Briefcase className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Rapport Projets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-4">
              <div className="text-2xl font-bold">{filteredProjects.length}</div>
              <div className="text-3xl font-bold text-primary">{avgProjectCompletionRate}%</div>
            </div>
            <CardDescription className="text-sm text-muted-foreground">Taux de completion</CardDescription>
          </CardContent>
          <CardContent>
            <div style={{ height: 300 }}>
              <AgGridReact<Project>
                theme={gridTheme}
                rowData={filteredProjects}
                columnDefs={projectColumnDefs}
                suppressCellFocus
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Chiffre d'Affaires</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-4">
              <div className="text-2xl font-bold">{filteredInvoices.length}</div>
              <div className="text-3xl font-bold text-ink">
                {formatCurrency(totalRevenue)}
              </div>
            </div>
            <CardDescription className="text-sm text-muted-foreground">
              Encaissé (factures PAID + PARTIAL)
            </CardDescription>
          </CardContent>
          <CardContent>
            <div style={{ height: 300 }}>
              <AgGridReact<Invoice>
                theme={gridTheme}
                rowData={filteredInvoices}
                columnDefs={invoiceColumnDefs}
                suppressCellFocus
                overlayNoRowsTemplate="Aucune facture encaissée sur la période."
              />
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}