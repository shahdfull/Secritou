import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Proposal } from "@/api/proposals.api";
import {
  useProposals,
  useDeleteProposal,
  useSendProposal,
  useAcceptProposal,
  useRejectProposal,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
} from "lucide-react";
import { DataTablePagination } from "@/components/common/DataTablePagination";
import { useListParams } from "@/hooks/useListParams";

const ALL_STATUSES_VALUE = "__all__";

export function ProposalsPage() {
  const { t } = useTranslation();
  const { page, pageSize, search, status, updateParams } = useListParams(10);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);

  const { data: proposalsResult, isLoading } = useProposals({
    page,
    pageSize,
    search,
    status,
  });

  const proposals = useMemo(
    () => Array.isArray(proposalsResult?.data) ? proposalsResult.data : [],
    [proposalsResult?.data]
  );

  const deleteMutation = useDeleteProposal();
  const sendMutation = useSendProposal();
  const acceptMutation = useAcceptProposal();
  const rejectMutation = useRejectProposal();

  const [rejectComment, setRejectComment] = useState("");

  const openRejectDialog = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setRejectComment("");
    setRejectDialogOpen(true);
  };

  const handleReject = () => {
    if (!selectedProposal) return;
    rejectMutation.mutate(
      { id: selectedProposal.id, comment: rejectComment },
      {
        onSuccess: () => setRejectDialogOpen(false),
      }
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "bg-gray-100 text-gray-800";
      case "SENT":
        return "bg-blue-100 text-blue-800";
      case "VIEWED":
        return "bg-yellow-100 text-yellow-800";
      case "ACCEPTED":
        return "bg-green-100 text-green-800";
      case "REJECTED":
        return "bg-red-100 text-red-800";
      case "EXPIRED":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("proposals.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("proposals.subtitle")}
          </p>
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
            <SelectItem value="VIEWED">
              {t("proposals.statuses.viewed")}
            </SelectItem>
            <SelectItem value="ACCEPTED">
              {t("proposals.statuses.accepted")}
            </SelectItem>
            <SelectItem value="REJECTED">
              {t("proposals.statuses.rejected")}
            </SelectItem>
            <SelectItem value="EXPIRED">
              {t("proposals.statuses.expired")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("proposals.proposalTitle")}</TableHead>
              <TableHead>{t("proposals.client")}</TableHead>
              <TableHead>{t("proposals.amount")}</TableHead>
              <TableHead>{t("proposals.date")}</TableHead>
              <TableHead>{t("proposals.status")}</TableHead>
              <TableHead className="text-right">
                {t("proposals.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">
                  {t("common.loading")}
                </TableCell>
              </TableRow>
) : proposals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">
                  {t("proposals.empty")}
                </TableCell>
              </TableRow>
            ) : (
              proposals.map((proposal: Proposal) => (
                <TableRow key={proposal.id}>
                  <TableCell className="font-medium">
                    {proposal.title}
                  </TableCell>
                  <TableCell>{proposal.client?.name}</TableCell>
                  <TableCell>
                    {proposal.amount} {proposal.currency}
                  </TableCell>
                  <TableCell>
                    {new Date(proposal.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(proposal.status)}>
                      {t(`proposals.statuses.${proposal.status.toLowerCase()}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {proposal.pdfUrl && (
                          <>
                            <DropdownMenuItem
                              onClick={() => window.open(proposal.pdfUrl, "_blank")}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              {t("proposals.view")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => window.open(proposal.pdfUrl, "_blank")}
                            >
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
                        {proposal.status === "SENT" ||
                        proposal.status === "VIEWED" ? (
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
                        ) : null}
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
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {proposalsResult && Number.isFinite(proposalsResult.page) && Number.isFinite(proposalsResult.pageSize) && Number.isFinite(proposalsResult.total) && proposalsResult.total > 0 && (
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
            <DialogDescription>
              {t("proposals.rejectModal.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder={t("proposals.rejectModal.reasonPlaceholder")}
              rows={4}
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRejectDialogOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleReject}
                disabled={rejectMutation.isPending}
              >
                {t("proposals.rejectModal.confirm")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
