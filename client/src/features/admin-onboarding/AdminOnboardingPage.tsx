import { useCallback, useMemo, useState } from "react";
import { formatDate } from "@/utils/format";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import "@/lib/agGridModules";
import {
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
} from "ag-grid-community";
import {
  useClientOnboardings,
  useCreateClientOnboarding,
} from "@/hooks/useClientOnboarding";
import type { ClientOnboarding, OnboardingStep } from "@secritou/shared";
import { useProjects } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTablePagination } from "@/components/common/DataTablePagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Eye } from "lucide-react";
import { useListParams } from "@/hooks/useListParams";


// Cohérent avec la migration AG Grid de TasksListView.tsx (mêmes tokens, thème clair unique).
const gridTheme = themeQuartz.withParams({
  accentColor: "#0f766e",
  headerBackgroundColor: "#f8fafc",
  headerTextColor: "#334155",
  rowHoverColor: "#f1f5f9",
  borderColor: "#e2e8f0",
  fontFamily: "inherit",
});

export function AdminOnboardingPage() {
  const { t } = useTranslation();
  const { params, updateParams } = useListParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const { data: onboardings, isLoading } = useClientOnboardings(params);
  const { data: projects } = useProjects();
  const createOnboarding = useCreateClientOnboarding();

  const handleCreateOnboarding = () => {
    if (!selectedProjectId) return;
    createOnboarding.mutate(
      { projectId: selectedProjectId },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setSelectedProjectId(null);
        },
      }
    );
  };

  const calculateProgress = (onboarding: ClientOnboarding) => {
    const completed = onboarding.steps.filter(
      (s) => s.status === "COMPLETED"
    ).length;
    return Math.round((completed / onboarding.steps.length) * 100);
  };

  const getOnboardingStatus = useCallback(
    (steps: OnboardingStep[]) => {
      if (steps.every((s) => s.status === "COMPLETED")) return t("onboarding.timeline.statuses.completed");
      if (steps.some((s) => s.status === "REJECTED")) return t("onboarding.timeline.statuses.rejected");
      if (steps.some((s) => s.status === "IN_PROGRESS" || s.status === "COMPLETED")) return t("onboarding.timeline.statuses.inProgress");
      return t("onboarding.timeline.statuses.pending");
    },
    [t]
  );

  const progressRenderer = useCallback(
    (params: ICellRendererParams<ClientOnboarding>) => {
      const onboarding = params.data;
      if (!onboarding) return null;
      const progress = calculateProgress(onboarding);
      return (
        <div className="flex h-full flex-col justify-center gap-1">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-primary h-2.5 rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs text-muted-foreground">{progress}%</span>
        </div>
      );
    },
    []
  );

  const actionsRenderer = useCallback(
    (params: ICellRendererParams<ClientOnboarding>) => {
      const onboarding = params.data;
      if (!onboarding) return null;
      return (
        <div className="flex h-full items-center justify-end">
          <Button asChild variant="ghost" size="icon">
            <Link to={`/app/client-onboarding/${onboarding.id}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      );
    },
    []
  );

  const columnDefs = useMemo<ColDef<ClientOnboarding>[]>(
    () => [
      { headerName: t("onboarding.admin.client"), valueGetter: (p) => p.data?.client.name, flex: 2, cellClass: "font-medium" },
      { headerName: t("onboarding.admin.project"), valueGetter: (p) => p.data?.project?.name ?? "—", flex: 2 },
      { headerName: t("onboarding.admin.status"), valueGetter: (p) => (p.data ? getOnboardingStatus(p.data.steps) : ""), flex: 1 },
      { headerName: t("onboarding.admin.progress"), cellRenderer: progressRenderer, flex: 1 },
      { headerName: t("onboarding.admin.createdAt"), valueFormatter: (p) => formatDate(p.data!.createdAt), field: "createdAt", flex: 1 },
      { headerName: t("onboarding.admin.actions"), cellRenderer: actionsRenderer, width: 100, sortable: false, resizable: false },
    ],
    [t, progressRenderer, actionsRenderer, getOnboardingStatus]
  );

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("onboarding.admin.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("onboarding.admin.subtitle")}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t("onboarding.admin.createOnboarding")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("onboarding.admin.createOnboarding")}</DialogTitle>
              <DialogDescription>
                {t("onboarding.admin.subtitle")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Select
                value={selectedProjectId || ""}
                onValueChange={setSelectedProjectId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("common.selectProject")} />
                </SelectTrigger>
                <SelectContent>
                  {projects?.data.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreateOnboarding}
                disabled={!selectedProjectId || createOnboarding.isPending}
              >
                {createOnboarding.isPending ? "Creating..." : t("onboarding.admin.createOnboarding")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Input
        placeholder={t("onboarding.admin.searchOnboardings")}
        value={(params.search as string | undefined) || ""}
        onChange={(e) => updateParams({ search: e.target.value, page: 1 })}
        className="mb-6 max-w-md"
      />

      <div className="border rounded-lg overflow-hidden" style={{ height: 500 }}>
        <AgGridReact<ClientOnboarding>
          theme={gridTheme}
          rowData={onboardings?.data ?? []}
          columnDefs={columnDefs}
          loading={isLoading}
          suppressCellFocus
          overlayLoadingTemplate="Loading..."
          overlayNoRowsTemplate={t("onboarding.admin.empty")}
        />
      </div>

      {onboardings && (
        <DataTablePagination
          page={onboardings.page}
          pageSize={onboardings.pageSize}
          total={onboardings.total}
          onPageChange={(nextPage) => updateParams({ page: nextPage })}
        />
      )}
    </section>
  );
}
