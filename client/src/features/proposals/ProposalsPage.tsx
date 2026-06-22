import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Proposal } from "@/api/proposals.api";
import {
  useProposals,
  useDeleteProposal,
  useSendProposal,
  useAcceptProposal,
  useRejectProposal,
  useCreateInvoiceFromProposal,
} from "@/hooks/useProposals";
import { useCreateProject } from "@/hooks/useProjects";
import { useCreateClientOnboarding } from "@/hooks/useClientOnboarding";
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
import { Label } from "@/components/ui/label";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  MoreHorizontal,
  Send,
  CheckCircle2,
  XCircle,
  Eye,
  Download,
  Receipt,
  FolderPlus,
  Loader2,
} from "lucide-react";
import { DataTablePagination } from "@/components/common/DataTablePagination";
import { useListParams } from "@/hooks/useListParams";
import { useLeads } from "@/hooks/useLeads";

const ALL_STATUSES_VALUE = "__all__";
const ALL_LEADS_VALUE = "__all__";

export function ProposalsPage() {
  const { t } = useTranslation();
  const { page, pageSize, search, status, updateParams } = useListParams(10);

  // Lead filter (kept in local state — not part of the shared URL list params).
  const [leadFilter, setLeadFilter] = useState<string>(ALL_LEADS_VALUE);
  const { data: leadsResult } = useLeads({ pageSize: 200 });
  const leads = useMemo(() => leadsResult?.data ?? [], [leadsResult?.data]);

  // Base dialogs
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [rejectComment, setRejectComment] = useState("");

  // Generate invoice dialog
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceProposal, setInvoiceProposal] = useState<Proposal | null>(null);
  // Track proposals that have just had an invoice created (session-local, backed by invoice.proposalId on refresh)
  const [invoicedProposalIds, setInvoicedProposalIds] = useState<Set<string>>(() => new Set());

  // Create project dialog
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectProposal, setProjectProposal] = useState<Proposal | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [withOnboarding, setWithOnboarding] = useState(true);

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
  const createProjectMutation = useCreateProject();
  const createOnboardingMutation = useCreateClientOnboarding();

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

  // --- Create Project ---
  const openProjectDialog = (proposal: Proposal) => {
    setProjectProposal(proposal);
    setProjectName(proposal.title);
    setProjectDescription(proposal.description ?? "");
    setWithOnboarding(true);
    setProjectDialogOpen(true);
  };

  const handleCreateProject = () => {
    if (!projectProposal) return;
    createProjectMutation.mutate(
      {
        name: projectName,
        description: projectDescription || undefined,
        clientId: projectProposal.clientId,
        status: "PLANNING",
      },
      {
        onSuccess: (project) => {
          setProjectDialogOpen(false);
          if (withOnboarding) {
            createOnboardingMutation.mutate({ projectId: project.id });
          }
        },
      }
    );
  };

  // --- Status color ---
  const getStatusColor = (s: string) => {
    switch (s) {
      case "DRAFT":    return "bg-gray-100 text-gray-800";
      case "SENT":     return "bg-blue-100 text-blue-800";
      case "VIEWED":   return "bg-yellow-100 text-yellow-800";
      case "ACCEPTED": return "bg-green-100 text-green-800";
      case "REJECTED": return "bg-red-100 text-red-800";
      case "EXPIRED":  return "bg-orange-100 text-orange-800";
      default:         return "bg-gray-100 text-gray-800";
    }
  };

  const isActing =
    createInvoiceMutation.isPending ||
    createProjectMutation.isPending ||
    createOnboardingMutation.isPending;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("proposals.title")}</h1>
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
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {proposal.amount} {proposal.currency}
                  </TableCell>
                  <TableCell>{new Date(proposal.createdAt).toLocaleDateString()}</TableCell>
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
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={() => openProjectDialog(proposal)}
                          >
                            <FolderPlus className="h-3.5 w-3.5" />
                            Projet
                          </Button>
                        </>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {proposal.pdfUrl && (
                            <>
                              <DropdownMenuItem onClick={() => window.open(proposal.pdfUrl, "_blank")}>
                                <Eye className="mr-2 h-4 w-4" />
                                {t("proposals.view")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => window.open(proposal.pdfUrl, "_blank")}>
                                <Download className="mr-2 h-4 w-4" />
                                {t("proposals.download")}
                              </DropdownMenuItem>
                            </>
                          )}
                          {proposal.status === "DRAFT" && (
                            <DropdownMenuItem
                              onClick={() => sendMutation.mutate(proposal.id)}
                              disabled={sendMutation.isPending}
                            >
                              <Send className="mr-2 h-4 w-4" />
                              {t("proposals.send")}
                            </DropdownMenuItem>
                          )}
                          {(proposal.status === "SENT" || proposal.status === "VIEWED") && (
                            <>
                              <DropdownMenuItem
                                onClick={() => acceptMutation.mutate(proposal.id)}
                                disabled={acceptMutation.isPending}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                                {t("proposals.accept")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openRejectDialog(proposal)}
                                disabled={rejectMutation.isPending}
                              >
                                <XCircle className="mr-2 h-4 w-4 text-red-600" />
                                {t("proposals.reject")}
                              </DropdownMenuItem>
                            </>
                          )}
                          {proposal.status === "ACCEPTED" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => openInvoiceDialog(proposal)}
                                disabled={!!(proposal.invoice || invoicedProposalIds.has(proposal.id))}
                              >
                                <Receipt className="mr-2 h-4 w-4 text-blue-600" />
                                {proposal.invoice || invoicedProposalIds.has(proposal.id)
                                  ? "Facture déjà créée"
                                  : "Générer une facture"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openProjectDialog(proposal)}>
                                <FolderPlus className="mr-2 h-4 w-4 text-purple-600" />
                                Créer un projet
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => deleteMutation.mutate(proposal.id)}
                            disabled={deleteMutation.isPending}
                            className="text-red-600"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            {t("proposals.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
              <Button onClick={handleReject} disabled={rejectMutation.isPending}>
                {t("proposals.rejectModal.confirm")}
              </Button>
            </DialogFooter>
          </div>
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
              <p className="font-medium">{invoiceProposal?.client?.name ?? "—"}</p>
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
            <Button onClick={handleCreateInvoice} disabled={isActing}>
              {createInvoiceMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer la facture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Project Dialog */}
      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-purple-600" />
              Créer un projet
            </DialogTitle>
            <DialogDescription>
              Projet pré-rempli depuis la proposition <strong>{projectProposal?.title}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nom du projet</Label>
              <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
              />
            </div>
            <div className="rounded-md border p-3 bg-muted/40 text-sm">
              <p className="text-muted-foreground">Client</p>
              <p className="font-medium">{projectProposal?.client?.name ?? "—"}</p>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={withOnboarding}
                onChange={(e) => setWithOnboarding(e.target.checked)}
                className="rounded"
              />
              Créer l'onboarding associé automatiquement
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setProjectDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateProject} disabled={isActing || !projectName.trim()}>
              {(createProjectMutation.isPending || createOnboardingMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Créer le projet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
