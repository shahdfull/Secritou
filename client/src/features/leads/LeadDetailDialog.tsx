import { useState } from "react";
import { formatDate } from "@/utils/format";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, Plus } from "lucide-react";
import { useLead } from "@/hooks/useLeads";
import type { Lead, LeadProposal } from "@/types/lead";
import { CreateProposalFromLeadDialog } from "./CreateProposalFromLeadDialog";

interface LeadDetailDialogProps {
  // The lead from the list/kanban (used as initial data while the detailed lead loads).
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PROPOSAL_STATUS_COLOR: Record<LeadProposal["status"], string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  SENT: "bg-blue-100 text-blue-800",
  VIEWED: "bg-yellow-100 text-yellow-800",
  ACCEPTED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  EXPIRED: "bg-orange-100 text-orange-800",
};

// A Proposal can only be created from a lead that is being actively pursued.
const CAN_CREATE_PROPOSAL: Lead["status"][] = ["CONTACTED", "QUALIFIED"];

export function LeadDetailDialog({ lead, open, onOpenChange }: LeadDetailDialogProps) {
  const { t } = useTranslation();
  const [proposalDialogOpen, setProposalDialogOpen] = useState(false);

  // Fetch the full lead (with linked proposals) only while the dialog is open.
  const { data: detailedLead, isLoading: isLoadingDetail } = useLead(open && lead ? lead.id : "");
  const current = detailedLead ?? lead;
  // Until the detailed fetch resolves, `current` falls back to the list-sourced `lead` prop,
  // which never carries `proposals` — without isLoadingDetail, an empty array here would show
  // "no proposals" even when the lead genuinely has some still loading, not actually empty.
  const proposals = current?.proposals ?? [];
  const canCreateProposal = !!current && CAN_CREATE_PROPOSAL.includes(current.status);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{current?.name}</DialogTitle>
            <DialogDescription>
              {current?.email || t("leadsPage.noEmail")}
              {current?.phone ? ` · ${current.phone}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {current?.sourceContact && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-ink">Source contact</p>
                  <Badge variant="outline">{current.sourceContact.status}</Badge>
                </div>
                <p className="text-muted-foreground">
                  {current.sourceContact.company} · {current.sourceContact.serviceType}
                </p>
                <p className="text-muted-foreground">{current.sourceContact.email}</p>
                {current.sourceContact.phone && (
                  <p className="text-muted-foreground">{current.sourceContact.phone}</p>
                )}
                <p className="whitespace-pre-wrap text-foreground/90">{current.sourceContact.message}</p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">
                {t("proposals.fromLead.linkedProposals")}
              </h3>
              {canCreateProposal && (
                <Button size="sm" onClick={() => setProposalDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  {t("proposals.fromLead.create")}
                </Button>
              )}
            </div>

            {isLoadingDetail ? (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("common.loading")}
              </div>
            ) : proposals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {t("proposals.fromLead.noProposals")}
              </p>
            ) : (
              <ul className="space-y-2">
                {proposals.map((proposal) => (
                  <li
                    key={proposal.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{proposal.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {proposal.amount != null
                            ? `${proposal.amount} ${proposal.currency}`
                            : ":"}{" "}
                          · {formatDate(proposal.createdAt)}
                        </p>
                      </div>
                    </div>
                    <Badge className={PROPOSAL_STATUS_COLOR[proposal.status]}>
                      {t(`proposals.statuses.${proposal.status.toLowerCase()}`)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <CreateProposalFromLeadDialog
        lead={current}
        open={proposalDialogOpen}
        onOpenChange={setProposalDialogOpen}
      />
    </>
  );
}
