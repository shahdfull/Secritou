import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AgGridReact } from "ag-grid-react";
import "@/lib/agGridModules";
import { themeQuartz, type ColDef } from "ag-grid-community";
import { formatDate } from "@/utils/format";
import type { MetricSnapshotRow } from "@/api/gscConnection.api";

// Cohérent avec la migration AG Grid de TasksListView.tsx (mêmes tokens, thème clair unique).
const gridTheme = themeQuartz.withParams({
  accentColor: "#0f766e",
  headerBackgroundColor: "#f8fafc",
  headerTextColor: "#334155",
  rowHoverColor: "#f1f5f9",
  borderColor: "#e2e8f0",
  fontFamily: "inherit",
});

const METRIC_LABELS: Record<string, string> = {
  clicks: "Clics",
  impressions: "Impressions",
  ctr: "Taux de clic (CTR, %)",
  position: "Position moyenne",
};

/**
 * Tableau Période/Métrique/Valeur des métriques Google Search Console — partagé entre
 * SearchConsoleTab.tsx (onglet client côté admin) et SeoReportPage.tsx (portail client),
 * mêmes colonnes et mise en forme des deux côtés.
 */
export function SeoMetricsGrid({
  rows,
  isLoading,
  emptyMessage,
}: {
  rows: MetricSnapshotRow[];
  isLoading: boolean;
  emptyMessage: string;
}) {
  const { t } = useTranslation();

  const columnDefs = useMemo<ColDef<MetricSnapshotRow>[]>(
    () => [
      {
        headerName: t("integrations.gsc.period", "Période"),
        field: "periodStart",
        flex: 1,
        valueFormatter: (params) => (params.value ? formatDate(params.value) : "-"),
      },
      {
        headerName: t("integrations.gsc.metric", "Métrique"),
        field: "metric",
        flex: 1,
        valueFormatter: (params) => METRIC_LABELS[params.value as string] ?? params.value,
      },
      {
        headerName: t("integrations.gsc.value", "Valeur"),
        field: "value",
        flex: 1,
        cellClass: "text-right font-medium",
        headerClass: "ag-right-aligned-header",
      },
    ],
    [t]
  );

  return (
    <div className="border rounded-lg overflow-hidden" style={{ height: 400 }}>
      <AgGridReact<MetricSnapshotRow>
        theme={gridTheme}
        rowData={rows}
        columnDefs={columnDefs}
        loading={isLoading}
        suppressCellFocus
        overlayLoadingTemplate={t("common.loading")}
        overlayNoRowsTemplate={emptyMessage}
      />
    </div>
  );
}
