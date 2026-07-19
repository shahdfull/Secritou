import { useState, useMemo } from "react";
import { formatDate } from "@/utils/format";
import { useTranslation } from "react-i18next";
import type { Approval } from "@/api/approvals.api";
import {
  useApprovals,
  useDeleteApproval,
  useApproveApproval,
  useRejectApproval,
  useCommentApproval,
  useAddApprovalAttachment,
  useDeleteApprovalAttachment,
} from "@/hooks/useApprovals";
import { FileUploadField } from "@/components/common/FileUploadField";
import type { UploadResult } from "@/api/upload.api";
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
  CheckCircle2,
  XCircle,
  MessageSquare,
  Eye,
  Clock,
  Trash2,
  Paperclip,
} from "lucide-react";
import { DataTablePagination } from "@/components/common/DataTablePagination";
import { useListParams } from "@/hooks/useListParams";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const ALL_STATUSES_VALUE = "__all__";

export function ApprovalsPage() {
  const { t } = useTranslation();
  const { page, pageSize, search, status, updateParams } = useListParams(10);
  const [dialogType, setDialogType] = useState<
    "reject" | "approve" | "comment" | null
  >(null);
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [timelineApproval, setTimelineApproval] = useState<Approval | null>(null);
  const [attachmentsApproval, setAttachmentsApproval] = useState<Approval | null>(null);
  const [comment, setComment] = useState("");

  const { data: approvalsResult, isLoading } = useApprovals({
    page,
    pageSize,
    search,
    status,
  });

  const approvals = useMemo(
    () => Array.isArray(approvalsResult?.data) ? approvalsResult.data : [],
    [approvalsResult?.data]
  );

  const deleteMutation = useDeleteApproval();
  const approveMutation = useApproveApproval();
  const rejectMutation = useRejectApproval();
  const commentMutation = useCommentApproval();
  const addAttachmentMutation = useAddApprovalAttachment();
  const deleteAttachmentMutation = useDeleteApprovalAttachment();

  const attachmentsApprovalLive =
    approvals.find((a) => a.id === attachmentsApproval?.id) ?? attachmentsApproval;

  const openDialog = (
    type: "reject" | "approve" | "comment",
    approval: Approval
  ) => {
    setSelectedApproval(approval);
    setComment("");
    setDialogType(type);
  };

  const handleSubmit = () => {
    if (!selectedApproval) return;
    if (dialogType === "approve") {
      approveMutation.mutate(
        { id: selectedApproval.id, comment },
        {
          onSuccess: () => setDialogType(null),
        }
      );
    } else if (dialogType === "reject") {
      rejectMutation.mutate(
        { id: selectedApproval.id, comment },
        {
          onSuccess: () => setDialogType(null),
        }
      );
    } else if (dialogType === "comment") {
      commentMutation.mutate(
        { id: selectedApproval.id, comment },
        {
          onSuccess: () => setDialogType(null),
        }
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-accent-soft text-accent-foreground";
      case "APPROVED":
        return "bg-green-100 text-green-800";
      case "REJECTED":
        return "bg-red-100 text-red-700";
      case "COMMENTED":
        return "bg-primary-soft text-primary-strong";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t("approvals.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("approvals.subtitle")}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Input
          placeholder={t("approvals.search")}
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
            <SelectValue placeholder={t("approvals.filterByStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES_VALUE}>{t("approvals.allStatuses")}</SelectItem>
            <SelectItem value="PENDING">
              {t("approvals.statuses.pending")}
            </SelectItem>
            <SelectItem value="APPROVED">
              {t("approvals.statuses.approved")}
            </SelectItem>
            <SelectItem value="REJECTED">
              {t("approvals.statuses.rejected")}
            </SelectItem>
            <SelectItem value="COMMENTED">
              {t("approvals.statuses.commented")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("approvals.approvalTitle")}</TableHead>
              <TableHead>{t("approvals.client")}</TableHead>
              <TableHead>{t("approvals.dueDate")}</TableHead>
              <TableHead>{t("approvals.status")}</TableHead>
              <TableHead className="text-right">
                {t("approvals.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">
                  {t("common.loading")}
                </TableCell>
              </TableRow>
            ) : approvals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">
                  {t("approvals.empty")}
                </TableCell>
              </TableRow>
            ) : (
              approvals.map((approval) => (
                <TableRow key={approval.id}>
                  <TableCell className="font-medium">
                    {approval.title}
                  </TableCell>
                  <TableCell>{approval.client?.name}</TableCell>
                  <TableCell>
                    {approval.dueDate
                      ? formatDate(approval.dueDate)
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(approval.status)}>
                      {t(`approvals.statuses.${approval.status.toLowerCase()}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title={t("approvals.view")} onClick={() => window.open(`/approvals/${approval.id}`, "_blank")}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title={t("approvals.viewTimeline")} onClick={() => setTimelineApproval(approval)}>
                        <Clock className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title={t("approvals.attachments")} onClick={() => setAttachmentsApproval(approval)}>
                        <Paperclip className="h-3.5 w-3.5" />
                      </Button>
                      {approval.status === "PENDING" && (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:bg-green-50" title={t("approvals.approve")} onClick={() => openDialog("approve", approval)} disabled={approveMutation.isPending}>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" title={t("approvals.reject")} onClick={() => openDialog("reject", approval)} disabled={rejectMutation.isPending}>
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title={t("approvals.comment")} onClick={() => openDialog("comment", approval)} disabled={commentMutation.isPending}>
                            <MessageSquare className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" title={t("approvals.delete")} onClick={() => deleteMutation.mutate(approval.id)} disabled={deleteMutation.isPending}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {approvalsResult && Number.isFinite(approvalsResult.total) && (
        <DataTablePagination
          page={approvalsResult.page}
          pageSize={approvalsResult.pageSize}
          total={approvalsResult.total}
          onPageChange={(nextPage) => updateParams({ page: nextPage })}
        />
      )}

      {/* Dialog */}
      <Dialog
        open={!!dialogType}
        onOpenChange={() => setDialogType(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogType === "approve"
                ? t("approvals.approveModal.title")
                : dialogType === "reject"
                ? t("approvals.rejectModal.title")
                : t("approvals.commentModal.title")}
            </DialogTitle>
            <DialogDescription>
              {dialogType === "approve"
                ? t("approvals.approveModal.description")
                : dialogType === "reject"
                ? t("approvals.rejectModal.description")
                : t("approvals.commentModal.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder={t("approvals.commentPlaceholder")}
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogType(null)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                className={
                  dialogType === "reject"
                    ? "bg-red-600 hover:bg-red-700 text-white rounded-full"
                    : "bg-ink hover:bg-ink/90 text-white rounded-full"
                }
              >
                {dialogType === "approve"
                  ? t("approvals.approveModal.confirm")
                  : dialogType === "reject"
                  ? t("approvals.rejectModal.confirm")
                  : t("approvals.commentModal.confirm")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Timeline Dialog */}
      <Dialog
        open={!!timelineApproval}
        onOpenChange={(o) => !o && setTimelineApproval(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t("approvals.timelineTitle")}: {timelineApproval?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[500px] overflow-y-auto">
            {timelineApproval?.timeline && timelineApproval.timeline.length > 0 ? (
              timelineApproval.timeline.map((entry) => (
                <div key={entry.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">{entry.action}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(entry.createdAt), "d MMMM yyyy HH:mm", { locale: fr })}
                    </span>
                  </div>
                  {entry.user && <p className="text-sm text-muted-foreground mb-1">By: {entry.user.name}</p>}
                  {entry.comment && <p className="text-sm">{entry.comment}</p>}
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground">No timeline entries yet</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTimelineApproval(null)}>
              {t("common.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attachments Dialog */}
      <Dialog
        open={!!attachmentsApproval}
        onOpenChange={(o) => !o && setAttachmentsApproval(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("approvals.attachments")}: {attachmentsApprovalLive?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {attachmentsApprovalLive?.attachments && attachmentsApprovalLive.attachments.length > 0 ? (
              <ul className="space-y-2">
                {attachmentsApprovalLive.attachments.map((att) => (
                  <li
                    key={att.id}
                    className="flex items-center justify-between gap-2 rounded-lg border p-2"
                  >
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-sm text-primary underline"
                    >
                      {att.name}
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-red-500 hover:bg-red-50"
                      title={t("approvals.deleteAttachment")}
                      disabled={deleteAttachmentMutation.isPending}
                      onClick={() =>
                        attachmentsApprovalLive &&
                        deleteAttachmentMutation.mutate({
                          id: attachmentsApprovalLive.id,
                          attachmentId: att.id,
                        })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                {t("approvals.noAttachments")}
              </p>
            )}

            <FileUploadField
              context="document"
              uploadImmediately
              label={t("approvals.uploadAttachment")}
              onUploaded={(result) => {
                if (!attachmentsApprovalLive || result instanceof File) return;
                const uploadResult = result as UploadResult;
                addAttachmentMutation.mutate({
                  id: attachmentsApprovalLive.id,
                  name: uploadResult.originalName,
                  url: uploadResult.url,
                });
              }}
              disabled={addAttachmentMutation.isPending}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachmentsApproval(null)}>
              {t("common.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
