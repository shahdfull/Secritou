import { useCallback, useEffect, useState, useMemo } from "react";
import { formatDate } from "@/utils/format";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();
import type { Proposal } from "@/api/proposals.api";
import { documentsApi } from "@/api/documents.api";
import {
  useProposals,
  useProposal,
  useDeleteProposal,
  useSendProposal,
  useAcceptProposal,
  useRejectProposal,
  useCreateInvoiceFromProposal,
} from "@/hooks/useProposals";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
} from "ag-grid-community";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  CheckCircle2,
  XCircle,
  Receipt,
  ExternalLink,
  Loader2,
  Clock,
  Trash2,
  Download,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { DataTablePagination } from "@/components/common/DataTablePagination";
import { useListParams } from "@/hooks/useListParams";
import { useLeads } from "@/hooks/useLeads";

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
const ALL_LEADS_VALUE = "__all__";

// Test-only surface: AG Grid's row action buttons live inside cellRenderers, which AG Grid never
// mounts in JSDOM (no real viewport to compute visible rows against — same constraint already
// hit for TasksListView's rows, but here there's no equivalent "selectAll()" API since these are
// individual per-row action buttons, not row selection). Tests call these directly instead of
// clicking a DOM button, exercising the exact same handler → dialog → mutation chain a real click
// would trigger. Never passed in production (ProposalsPage is only ever rendered via a route).
export interface ProposalsPageTestHooks {
  openAcceptDialog: (proposal: Proposal) => void;
  openInvoiceDialog: (proposal: Proposal) => void;
  navigateToLinkedProject: (proposal: Proposal) => void;
}

interface ProposalsPageProps {
  onTestHooksReady?: (hooks: ProposalsPageTestHooks) => void;
}

export function ProposalsPage({ onTestHooksReady }: ProposalsPageProps = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { page, pageSize, search, status, updateParams } = useListParams(10);

  // Lead filter (kept in local state : not part of the shared URL list params).
  const [leadFilter, setLeadFilter] = useState<string>(ALL_LEADS_VALUE);
  const { data: leadsResult } = useLeads({ pageSize: 200 });
  const leads = useMemo(() => leadsResult?.data ?? [], [leadsResult?.data]);

  // Base dialogs
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [rejectComment, setRejectComment] = useState("");

  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Proposal | null>(null);

  // Accept-cascade confirmation dialog
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [acceptTarget, setAcceptTarget] = useState<Proposal | null>(null);

  // Generate invoice dialog
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceProposal, setInvoiceProposal] = useState<Proposal | null>(null);

  // Invoice PDF preview
  const [invoicePdfUrl, setInvoicePdfUrl] = useState<string | null>(null);
  const [invoicePdfLoading, setInvoicePdfLoading] = useState(false);
  const [numPages, setNumPages] = useState<number>(0);

  const handleViewInvoice = useCallback(
    async (proposal: Proposal) => {
      const documentId = proposal.invoice?.documents?.[0]?.id;
      if (!documentId) {
        toast.error(t("proposals.invoicePdfUnavailable"));
        return;
      }
      setInvoicePdfLoading(true);
      try {
        const { url } = await documentsApi.getDownloadUrl(documentId);
        setInvoicePdfUrl(url);
      } catch {
        toast.error(t("toasts.pdfLoadError"));
      } finally {
        setInvoicePdfLoading(false);
      }
    },
    [t]
  );

  // Timeline (history) dialog
  const [timelineProposalId, setTimelineProposalId] = useState<string | null>(null);
  const { data: timelineProposal, isLoading: isTimelineLoading } = useProposal(timelineProposalId ?? "");

  const { data: proposalsResult, isLoading } = useProposals({
    page,
    pageSize,
    search,
    status,
    leadId: leadFilter === ALL_LEADS_VALUE ? undefined : leadFilter,
  });
  const proposals = useMemo(
    () => (Array.isArray(proposalsResult?.data) ? proposalsResult.data : []),
    [proposalsResult?.data]
  );

  const deleteMutation = useDeleteProposal();
  const sendMutation = useSendProposal();
  const acceptMutation = useAcceptProposal();
  const rejectMutation = useRejectProposal();
  const createInvoiceMutation = useCreateInvoiceFromProposal();

  // --- Accept (cascade) ---
  const openAcceptDialog = (proposal: Proposal) => {
    setAcceptTarget(proposal);
    setAcceptDialogOpen(true);
  };

  const handleAccept = () => {
    if (!acceptTarget) return;
    acceptMutation.mutate(acceptTarget.id, {
      onSuccess: (res) => {
        setAcceptDialogOpen(false);
        if (res.meta?.clientInvited) toast.success(t("proposals.acceptCascade.clientInvited"));
        if (res.meta?.projectId) navigate(`/app/projects/${res.meta.projectId}`);
      },
    });
  };

  // --- Reject ---
  const openRejectDialog = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setRejectComment("");
    setRejectDialogOpen(true);
  };

  const handleReject = () => {
    if (!selectedProposal) return;
    rejectMutation.mutate(
      { id: selectedProposal.id, comment: rejectComment },
      { onSuccess: () => setRejectDialogOpen(false) }
    );
  };

  // --- Delete ---
  const openDeleteDialog = (proposal: Proposal) => {
    setDeleteTarget(proposal);
    setDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteDialogOpen(false),
    });
  };

  // --- Generate Invoice ---
  const openInvoiceDialog = (proposal: Proposal) => {
    setInvoiceProposal(proposal);
    setInvoiceDialogOpen(true);
  };

  const handleCreateInvoice = () => {
    if (!invoiceProposal) return;
    createInvoiceMutation.mutate(invoiceProposal.id, {
      onSuccess: () => setInvoiceDialogOpen(false),
    });
  };

  const navigateToLinkedProject = useCallback(
    (proposal: Proposal) => {
      if (proposal.linkedProject) navigate(`/app/projects/${proposal.linkedProject.id}`);
    },
    [navigate]
  );

  useEffect(() => {
    onTestHooksReady?.({ openAcceptDialog, openInvoiceDialog, navigateToLinkedProject });
  }, [onTestHooksReady, navigateToLinkedProject]);

  // --- Status color ---
  const getStatusColor = (s: string) => {
    switch (s) {
      case "DRAFT":    return "bg-muted text-muted-foreground";
      case "SENT":     return "bg-primary-soft text-primary-strong";
      case "VIEWED":   return "bg-accent-soft text-accent-strong";
      case "ACCEPTED": return "bg-green-100 text-green-800";
      case "REJECTED": return "bg-red-100 text-red-700";
      case "EXPIRED":  return "bg-muted text-muted-foreground";
      default:         return "bg-muted text-muted-foreground";
    }
  };

  const isActing = createInvoiceMutation.isPending;

  const leadRenderer = useCallback((params: ICellRendererParams<Proposal>) => {
    const proposal = params.data;
    if (!proposal) return null;
    return (
      <div className="flex h-full items-center">
        {proposal.lead ? (
          <Badge variant="outline">{proposal.lead.name}</Badge>
        ) : (
          <span className="text-muted-foreground">:</span>
        )}
      </div>
    );
  }, []);

  const statusRenderer = useCallback(
    (params: ICellRendererParams<Proposal>) => {
      const proposal = params.data;
      if (!proposal) return null;
      return (
        <div className="flex h-full flex-col justify-center gap-1 py-1">
          <Badge className={getStatusColor(proposal.status) + " w-fit"}>
            {t(`proposals.statuses.${proposal.status.toLowerCase()}`)}
          </Badge>
          {proposal.invoice && (
            <Badge className="bg-green-100 text-green-800 w-fit">
              <Receipt className="h-3 w-3 mr-1" />
              {t("proposals.invoiced")}
            </Badge>
          )}
        </div>
      );
    },
    [t]
  );

  const actionsRenderer = useCallback(
    (params: ICellRendererParams<Proposal>) => {
      const proposal = params.data;
      if (!proposal) return null;
      const canSend = proposal.status === "DRAFT";
      const canRespond = proposal.status === "SENT" || proposal.status === "VIEWED";
      const isAccepted = proposal.status === "ACCEPTED";
      const canDelete = proposal.status === "DRAFT";
      const statusGateTitle = t("proposals.actionUnavailable", "Non disponible pour ce statut");
      return (
        <div className="flex h-full items-center justify-end py-1">
          <div className="flex flex-wrap items-center justify-end gap-1 max-w-full">
            <Button variant="ghost" size="icon" className="h-7 w-7" title={t("proposals.viewTimeline")} onClick={() => setTimelineProposalId(proposal.id)}>
              <Clock className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title={canSend ? t("proposals.send") : statusGateTitle}
              onClick={() => sendMutation.mutate(proposal.id)}
              disabled={!canSend || sendMutation.isPending}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-green-600 hover:bg-green-50 disabled:text-muted-foreground"
              title={canRespond ? t("proposals.accept") : statusGateTitle}
              onClick={() => openAcceptDialog(proposal)}
              disabled={!canRespond || acceptMutation.isPending}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-red-500 hover:bg-red-50 disabled:text-muted-foreground"
              title={canRespond ? t("proposals.reject") : statusGateTitle}
              onClick={() => openRejectDialog(proposal)}
              disabled={!canRespond || rejectMutation.isPending}
            >
              <XCircle className="h-3.5 w-3.5" />
            </Button>
            {proposal.invoice ? (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:bg-blue-50" title={t("proposals.viewInvoice")} onClick={() => handleViewInvoice(proposal)} disabled={invoicePdfLoading}>
                {invoicePdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-blue-600 hover:bg-blue-50 disabled:text-muted-foreground"
                title={isAccepted ? t("proposals.generateInvoice") : statusGateTitle}
                onClick={() => openInvoiceDialog(proposal)}
                disabled={!isAccepted}
              >
                <Receipt className="h-3.5 w-3.5" />
              </Button>
            )}
            {proposal.linkedProject && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-purple-600 hover:bg-purple-50" title={t("proposals.viewProject")} onClick={() => navigate(`/app/projects/${proposal.linkedProject!.id}`)}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 disabled:text-muted-foreground"
              title={canDelete ? t("proposals.delete") : statusGateTitle}
              onClick={() => openDeleteDialog(proposal)}
              disabled={!canDelete || deleteMutation.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      );
    },
    [t, navigate, invoicePdfLoading, handleViewInvoice, sendMutation, acceptMutation.isPending, rejectMutation.isPending, deleteMutation.isPending]
  );

  const columnDefs = useMemo<ColDef<Proposal>[]>(
    () => [
      { headerName: t("proposals.proposalTitle"), field: "title", flex: 2, cellClass: "font-medium" },
      { headerName: t("proposals.client"), valueGetter: (p) => p.data?.client?.name, flex: 1 },
      { headerName: t("proposals.sourceLead"), cellRenderer: leadRenderer, flex: 1 },
      { headerName: t("proposals.amount"), valueFormatter: (p) => `${p.data!.amount} ${p.data!.currency}`, field: "amount", flex: 1 },
      { headerName: t("proposals.date"), valueFormatter: (p) => formatDate(p.data!.createdAt), field: "createdAt", flex: 1 },
      { headerName: t("proposals.status"), cellRenderer: statusRenderer, flex: 1, autoHeight: true },
      { headerName: t("proposals.actions"), cellRenderer: actionsRenderer, width: 260, sortable: false, resizable: false, autoHeight: true },
    ],
    [t, leadRenderer, statusRenderer, actionsRenderer]
  );

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t("proposals.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("proposals.subtitle")}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Input
          placeholder={t("proposals.search")}
          value={search || ""}
          onChange={(e) => updateParams({ search: e.target.value, page: 1 })}
          className="max-w-sm"
        />
        <Select
          value={status || ALL_STATUSES_VALUE}
          onValueChange={(value) =>
            updateParams({ status: value === ALL_STATUSES_VALUE ? undefined : value, page: 1 })
          }
        >
          <SelectTrigger className="max-w-sm">
            <SelectValue placeholder={t("proposals.filterByStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES_VALUE}>{t("proposals.allStatuses")}</SelectItem>
            <SelectItem value="DRAFT">{t("proposals.statuses.draft")}</SelectItem>
            <SelectItem value="SENT">{t("proposals.statuses.sent")}</SelectItem>
            <SelectItem value="VIEWED">{t("proposals.statuses.viewed")}</SelectItem>
            <SelectItem value="ACCEPTED">{t("proposals.statuses.accepted")}</SelectItem>
            <SelectItem value="REJECTED">{t("proposals.statuses.rejected")}</SelectItem>
            <SelectItem value="EXPIRED">{t("proposals.statuses.expired")}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={leadFilter}
          onValueChange={(value) => {
            setLeadFilter(value);
            updateParams({ page: 1 });
          }}
        >
          <SelectTrigger className="max-w-sm">
            <SelectValue placeholder={t("proposals.filterByLead")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_LEADS_VALUE}>{t("proposals.allLeads")}</SelectItem>
            {leads.map((lead) => (
              <SelectItem key={lead.id} value={lead.id}>
                {lead.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-hidden" style={{ height: 500 }}>
        <AgGridReact<Proposal>
          theme={gridTheme}
          rowData={proposals}
          columnDefs={columnDefs}
          loading={isLoading}
          suppressCellFocus
          overlayLoadingTemplate={t("common.loading")}
          overlayNoRowsTemplate={t("proposals.empty")}
        />
      </div>

      {proposalsResult &&
        Number.isFinite(proposalsResult.page) &&
        Number.isFinite(proposalsResult.pageSize) &&
        Number.isFinite(proposalsResult.total) &&
        proposalsResult.total > 0 && (
          <DataTablePagination
            page={proposalsResult.page}
            pageSize={proposalsResult.pageSize}
            total={proposalsResult.total}
            onPageChange={(nextPage) => updateParams({ page: nextPage })}
          />
        )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("proposals.rejectModal.title")}</DialogTitle>
            <DialogDescription>{t("proposals.rejectModal.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder={t("proposals.rejectModal.reasonPlaceholder")}
              rows={4}
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRejectDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleReject}
                disabled={rejectMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white rounded-full"
              >
                {t("proposals.rejectModal.confirm")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("proposals.deleteModal.title")}</DialogTitle>
            <DialogDescription>{t("proposals.deleteModal.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)}>
              {t("proposals.deleteModal.cancel")}
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white rounded-full"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("proposals.deleteModal.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accept (cascade) Dialog */}
      <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              {t("proposals.acceptCascade.title")}
            </DialogTitle>
            <DialogDescription>{t("proposals.acceptCascade.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 rounded-md border p-3 bg-muted/40 text-sm">
              <div>
                <p className="text-muted-foreground">{t("proposals.client")}</p>
                <p className="font-medium">
                  {acceptTarget?.client?.name ?? acceptTarget?.clientName ?? ":"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("proposals.amount")}</p>
                <p className="font-medium">
                  {acceptTarget?.amount} {acceptTarget?.currency}
                </p>
              </div>
            </div>
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
              <li>{t("proposals.acceptCascade.willCreateProject", { name: acceptTarget?.title ?? "" })}</li>
              <li>{t("proposals.acceptCascade.willInvoiceDeposit")}</li>
              <li>{t("proposals.acceptCascade.willInviteClient")}</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAcceptDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleAccept}
              disabled={acceptMutation.isPending}
              className="bg-ink hover:bg-ink/90 text-white rounded-full"
            >
              {acceptMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("proposals.acceptCascade.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Invoice Dialog */}
      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-blue-600" />
              {t("proposals.invoiceDialog.title")}
            </DialogTitle>
            <DialogDescription>
              {t("proposals.invoiceDialog.description")} <strong>{invoiceProposal?.title}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 rounded-md border p-3 bg-muted/40 text-sm">
            <div>
              <p className="text-muted-foreground">{t("proposals.client")}</p>
              <p className="font-medium">{invoiceProposal?.client?.name ?? ":"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("proposals.amount")}</p>
              <p className="font-medium">
                {invoiceProposal?.amount} {invoiceProposal?.currency}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInvoiceDialogOpen(false)}>
              {t("proposals.invoiceDialog.cancel")}
            </Button>
            <Button
              onClick={handleCreateInvoice}
              disabled={isActing}
              className="bg-ink hover:bg-ink/90 text-white rounded-full"
            >
              {createInvoiceMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("proposals.invoiceDialog.createInvoice")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Timeline Dialog */}
      <Dialog open={!!timelineProposalId} onOpenChange={(o) => !o && setTimelineProposalId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t("proposals.timelineTitle")}: {timelineProposal?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[500px] overflow-y-auto">
            {isTimelineLoading ? (
              <p className="text-center text-muted-foreground py-6">{t("common.loading")}</p>
            ) : timelineProposal?.history && timelineProposal.history.length > 0 ? (
              timelineProposal.history.map((entry) => (
                <div key={entry.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">{entry.action}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(entry.createdAt), "d MMMM yyyy HH:mm", { locale: fr })}
                    </span>
                  </div>
                  {entry.user && <p className="text-sm text-muted-foreground mb-1">{t("proposals.byUser", { name: entry.user.name })}</p>}
                  {entry.comment && <p className="text-sm">{entry.comment}</p>}
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground">{t("proposals.noTimelineEntries")}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTimelineProposalId(null)}>
              {t("common.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice PDF Preview Dialog */}
      <Dialog open={!!invoicePdfUrl} onOpenChange={() => setInvoicePdfUrl(null)}>
        <DialogContent className="max-w-3xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t("proposals.invoicePreview")}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto flex flex-col items-center bg-muted/30 rounded p-2">
            <Document
              file={invoicePdfUrl}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              onLoadError={() => toast.error(t("toasts.pdfLoadError"))}
              loading={<p className="text-sm text-muted-foreground mt-10">{t("proposals.loadingPdf")}</p>}
            >
              {Array.from({ length: numPages }, (_, i) => (
                <Page key={i + 1} pageNumber={i + 1} width={700} className="mb-2 shadow" />
              ))}
            </Document>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => window.open(invoicePdfUrl!, "_blank")}>
              <Download className="mr-2 h-4 w-4" /> {t("proposals.download")}
            </Button>
            <Button variant="ghost" onClick={() => setInvoicePdfUrl(null)}>
              {t("common.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </section>
  );
}
