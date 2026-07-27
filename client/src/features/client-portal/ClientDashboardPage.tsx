import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useMyProjects } from "./hooks/useMyProjects";
import { useClientServiceRequests } from "@/hooks/useServiceRequests";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, MessageSquare, FileText, Download, Wallet, CalendarClock, TrendingUp, ChevronRight, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { documentsApi, type Document } from "@/api/documents.api";
import { clientPortalApi } from "@/api/clientPortal.api";
import { useAuthStore } from "@/store/auth.store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { formatNumber } from "@/utils/format";

// Small inline error state for a single dashboard block, with its own retry
// action — replaces the old single page-wide error banner so one failed
// query doesn't hide the other blocks that loaded fine.
function BlockError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-2 text-sm text-destructive">
      <span>{t("errors.loadFailed")}</span>
      <Button variant="ghost" size="sm" onClick={onRetry} className="h-7 gap-1.5 text-destructive hover:text-destructive">
        <RefreshCw className="h-3.5 w-3.5" />
        {t("common.retry")}
      </Button>
    </div>
  );
}

export function ClientDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const {
    data: projectsResult,
    isLoading: projectsLoading,
    isError: projectsError,
    refetch: refetchProjects,
  } = useMyProjects();
  const projects = projectsResult?.data ?? [];
  const {
    data: requestsResult,
    isLoading: requestsLoading,
    isError: requestsError,
    refetch: refetchRequests,
  } = useClientServiceRequests();
  const {
    data: documentsResult,
    isLoading: documentsLoading,
    isError: documentsError,
    refetch: refetchDocuments,
  } = useQuery({
    queryKey: ["clientDocuments", user?.clientId],
    queryFn: () => user?.clientId ? documentsApi.getDocuments({ clientId: user.clientId }) : Promise.resolve({ data: [], total: 0, page: 1, pageSize: 10 }),
    enabled: !!user?.clientId,
  });
  const documents = documentsResult?.data ?? [];
  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ["clientPortalSummary"],
    queryFn: clientPortalApi.getSummary,
  });
  const downloadDocumentMutation = useMutation({
    mutationFn: (documentId: string) => documentsApi.getDownloadUrl(documentId),
    onSuccess: ({ url }) => window.open(url, "_blank"),
  });

  const stats = [
    {
      title: t("clientPortal.dashboard.stats.projects"),
      value: projectsResult?.total ?? projects?.length ?? 0,
      icon: Briefcase,
      color: "bg-blue-50 text-blue-600",
      isLoading: projectsLoading,
      isError: projectsError,
      onRetry: refetchProjects,
      onClick: () => navigate("/client/projects"),
    },
    {
      title: t("clientPortal.dashboard.stats.requests"),
      value: requestsResult?.total ?? requestsResult?.data?.length ?? 0,
      icon: MessageSquare,
      color: "bg-purple-50 text-purple-600",
      isLoading: requestsLoading,
      isError: requestsError,
      onRetry: refetchRequests,
      onClick: () => navigate("/client/requests"),
    },
    {
      title: t("clientPortal.dashboard.stats.documents"),
      value: documentsResult?.total ?? documents?.length ?? 0,
      icon: FileText,
      color: "bg-green-50 text-green-600",
      isLoading: documentsLoading,
      isError: documentsError,
      onRetry: refetchDocuments,
      onClick: undefined,
    },
  ];

  const getDocumentTypeLabel = useCallback((doc: Document) => {
    switch (doc.type) {
      case 'INVOICE': return t("clientPortal.dashboard.documentTypes.invoice");
      case 'CONTRACT': return t("clientPortal.dashboard.documentTypes.contract");
      case 'OTHER': return t("clientPortal.dashboard.documentTypes.other");
      default: return t("clientPortal.dashboard.documentTypes.default");
    }
  }, [t]);

  return (
    <div className="container-page max-w-6xl mx-auto py-8 space-y-8">
      <h1 className="text-3xl font-bold text-ink">{t("clientPortal.dashboard.title")}</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="rounded-3xl border border-border shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("clientPortal.dashboard.outstandingBalance")}</CardTitle>
            <div className="p-2 rounded-full bg-orange-50 text-orange-600">
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : summaryError ? (
              <BlockError onRetry={refetchSummary} />
            ) : (
              <div className="text-2xl font-bold">
                {summary ? `${formatNumber(summary.outstandingBalance)} TND` : "—"}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-border shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("clientPortal.dashboard.nextDueInvoice")}</CardTitle>
            <div className="p-2 rounded-full bg-red-50 text-red-600">
              <CalendarClock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : summaryError ? (
              <BlockError onRetry={refetchSummary} />
            ) : summary?.nextDueInvoice ? (
              <div>
                <div className="text-2xl font-bold">
                  {formatNumber(summary.nextDueInvoice.amount - summary.nextDueInvoice.amountPaid)} {summary.nextDueInvoice.currency}
                </div>
                {summary.nextDueInvoice.dueDate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(summary.nextDueInvoice.dueDate), "dd/MM/yyyy", { locale: fr })}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-2xl font-bold text-muted-foreground">—</div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-border shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("clientPortal.dashboard.projectProgress")}</CardTitle>
            <div className="p-2 rounded-full bg-blue-50 text-blue-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : summaryError ? (
              <BlockError onRetry={refetchSummary} />
            ) : summary?.currentProject ? (
              <div className="space-y-2">
                <div className="text-2xl font-bold">{summary.currentProject.progress}%</div>
                <Progress value={summary.currentProject.progress} className="h-1.5" />
                <p className="text-xs text-muted-foreground truncate">{summary.currentProject.projectName}</p>
              </div>
            ) : (
              <div className="text-2xl font-bold text-muted-foreground">—</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const interactive = !!stat.onClick;
          return (
            <Card
              key={stat.title}
              className={[
                "rounded-3xl border border-border shadow-soft transition-shadow",
                interactive ? "hover:shadow-md cursor-pointer focus-within:ring-2 focus-within:ring-primary/30" : "",
              ].join(" ")}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-label={interactive ? `${stat.title} - ${t("clientPortal.dashboard.openSection")}` : stat.title}
              onClick={stat.onClick}
              onKeyDown={(e) => {
                if (!interactive) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  stat.onClick?.();
                }
              }}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <div className={`p-2 rounded-full ${stat.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between">
                  {stat.isLoading ? (
                    <Skeleton className="h-8 w-12" />
                  ) : stat.isError ? (
                    <BlockError onRetry={stat.onRetry} />
                  ) : (
                    <div className="text-2xl font-bold">{stat.value}</div>
                  )}
                  {interactive && !stat.isLoading && !stat.isError && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("clientPortal.dashboard.myDocuments")}</CardTitle>
        </CardHeader>
        <CardContent>
          {documentsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          ) : documentsError ? (
            <BlockError onRetry={refetchDocuments} />
          ) : documents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t("clientPortal.dashboard.noDocuments")}</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-border px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink truncate">{doc.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{getDocumentTypeLabel(doc)}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(doc.createdAt), "dd/MM/yyyy", { locale: fr })}
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => downloadDocumentMutation.mutate(doc.id)}>
                    <Download className="h-4 w-4 mr-2" />
                    {t("clientPortal.dashboard.download")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
