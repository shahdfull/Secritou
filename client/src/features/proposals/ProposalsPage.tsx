import { useState, useMemo } from "react";
import { formatDate } from "@/utils/format";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { Proposal } from "@/api/proposals.api";
import {
  useProposals,
  useDeleteProposal,
  useSendProposal,
  useAcceptProposal,
  useRejectProposal,
  useCreateInvoiceFromProposal,
} from "@/hooks/useProposals";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Eye,
  Download,
  Receipt,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { DataTablePagination } from "@/components/common/DataTablePagination";
import { useListParams } from "@/hooks/useListParams";
import { useLeads } from "@/hooks/useLeads";

const ALL_STATUSES_VALUE = "__all__";
const ALL_LEADS_VALUE = "__all__";

export function ProposalsPage() {
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

  // Accept-cascade confirmation dialog
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [acceptTarget, setAcceptTarget] = useState<Proposal | null>(null);

  // Generate invoice dialog
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceProposal, setInvoiceProposal] = useState<Proposal | null>(null);
  // Track proposals that have just had an invoice created (session-local, backed by invoice.proposalId on refresh)
  const [invoicedProposalIds, setInvoicedProposalIds] = useState<Set<string>>(() => new Set());

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

  // --- Generate Invoice ---
  const openInvoiceDialog = (proposal: Proposal) => {
    setInvoiceProposal(proposal);
    setInvoiceDialogOpen(true);
  };

  const handleCreateInvoice = () => {
    if (!invoiceProposal) return;
    createInvoiceMutation.mutate(invoiceProposal.id, {
      onSuccess: () => {
        setInvoicedProposalIds((prev) => new Set(prev).add(invoiceProposal.id));
        setInvoiceDialogOpen(false);
      },
    });
  };

  // --- Status color ---
  const getStatusColor = (s: string) => {
    switch (s) {
      case "DRAFT":    return "bg-muted text-muted-foreground";
      case "SENT":     return "bg-primary-soft text-primary";
      case "VIEWED":   return "bg-accent-soft text-accent-foreground";
      case "ACCEPTED": return "bg-green-100 text-green-800";
      case "REJECTED": return "bg-red-100 text-red-700";
      case "EXPIRED":  return "bg-muted text-muted-foreground";
      default:         return "bg-muted text-muted-foreground";
    }
  };

  const isActing = createInvoiceMutation.isPending;

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

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("proposals.proposalTitle")}</TableHead>
              <TableHead>{t("proposals.client")}</TableHead>
              <TableHead>{t("proposals.sourceLead")}</TableHead>
              <TableHead>{t("proposals.amount")}</TableHead>
              <TableHead>{t("proposals.date")}</TableHead>
              <TableHead>{t("proposals.status")}</TableHead>
              <TableHead className="text-right">{t("proposals.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10">
                  {t("common.loading")}
                </TableCell>
              </TableRow>
            ) : proposals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10">
                  {t("proposals.empty")}
                </TableCell>
              </TableRow>
            ) : (
              proposals.map((proposal: Proposal) => (
                <TableRow key={proposal.id}>
                  <TableCell className="font-medium">{proposal.title}</TableCell>
                  <TableCell>{proposal.client?.name}</TableCell>
                  <TableCell>
                    {proposal.lead ? (
                      <Badge variant="outline">{proposal.lead.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground">:</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {proposal.amount} {proposal.currency}
                  </TableCell>
                  <TableCell>{formatDate(proposal.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge className={getStatusColor(proposal.status)}>
                        {t(`proposals.statuses.${proposal.status.toLowerCase()}`)}
                      </Badge>
                      {(proposal.invoice || invoicedProposalIds.has(proposal.id)) && (
                        <Badge className="bg-green-100 text-green-800 w-fit">
                          <Receipt className="h-3 w-3 mr-1" />
                          Facturé
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Quick-action buttons for ACCEPTED proposals */}
                      {proposal.status === "ACCEPTED" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={() => openInvoiceDialog(proposal)}
                            disabled={!!(proposal.invoice || invoicedProposalIds.has(proposal.id))}
                            title={proposal.invoice || invoicedProposalIds.has(proposal.id) ? "Facture déjà créée" : undefined}
                          >
                            <Receipt className="h-3.5 w-3.5" />
                            Facture
                          </Button>
                          {proposal.linkedProject && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs gap-1"
                              onClick={() => navigate(`/app/projects/${proposal.linkedProject!.id}`)}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Projet
                            </Button>
                          )}
                        </>
                      )}

                      <div className="flex items-center gap-1">
                        {proposal.pdfUrl && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title={t("proposals.view")} onClick={() => window.open(proposal.pdfUrl, "_blank")}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title={t("proposals.download")} onClick={() => window.open(proposal.pdfUrl, "_blank")}>
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {proposal.status === "DRAFT" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title={t("proposals.send")} onClick={() => sendMutation.mutate(proposal.id)} disabled={sendMutation.isPending}>
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {(proposal.status === "SENT" || proposal.status === "VIEWED") && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:bg-green-50" title={t("proposals.accept")} onClick={() => openAcceptDialog(proposal)} disabled={acceptMutation.isPending}>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" title={t("proposals.reject")} onClick={() => openRejectDialog(proposal)} disabled={rejectMutation.isPending}>
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {proposal.status === "ACCEPTED" && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:bg-blue-50" title={proposal.invoice || invoicedProposalIds.has(proposal.id) ? "Facture déjà créée" : "Générer une facture"} onClick={() => openInvoiceDialog(proposal)} disabled={!!(proposal.invoice || invoicedProposalIds.has(proposal.id))}>
                              <Receipt className="h-3.5 w-3.5" />
                            </Button>
                            {proposal.linkedProject && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-purple-600 hover:bg-purple-50" title="Voir le projet" onClick={() => navigate(`/app/projects/${proposal.linkedProject!.id}`)}>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </>
                        )}
                        {proposal.status === "DRAFT" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" title={t("proposals.delete")} onClick={() => deleteMutation.mutate(proposal.id)} disabled={deleteMutation.isPending}>
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
              Générer une facture
            </DialogTitle>
            <DialogDescription>
              Facture pré-remplie depuis la proposition <strong>{invoiceProposal?.title}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 rounded-md border p-3 bg-muted/40 text-sm">
            <div>
              <p className="text-muted-foreground">Client</p>
              <p className="font-medium">{invoiceProposal?.client?.name ?? ":"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Montant</p>
              <p className="font-medium">
                {invoiceProposal?.amount} {invoiceProposal?.currency}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInvoiceDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleCreateInvoice}
              disabled={isActing}
              className="bg-ink hover:bg-ink/90 text-white rounded-full"
            >
              {createInvoiceMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer la facture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </section>
  );
}
