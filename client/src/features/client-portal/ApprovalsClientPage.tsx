import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/shared/crud/ConfirmationDialog";
import apiClient from "@/api/axios";
import type { Approval as ApiApproval } from "@/api/approvals.api";
import { getServerErrorMessage, getServerRequestId } from "@/utils/apiError";
import { getApprovalStatusBadgeClass } from "@/utils/statusColors";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle, XCircle, MessageSquare, ClipboardCheck, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Approval = ApiApproval & {
  attachments: { id: string; name: string; url: string }[];
};

type RespondAction = "reject" | "comment";

export function ApprovalsClientPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogApproval, setDialogApproval] = useState<Approval | null>(null);
  const [timelineApproval, setTimelineApproval] = useState<Approval | null>(null);
  const [action, setAction] = useState<RespondAction>("comment");
  const [comment, setComment] = useState("");
  // RG-026 Niveau 2 : l'approbation (irréversible) utilise le composant partagé
  // ConfirmationDialog, comme les 6 autres actions Niveau 2 — isolée de reject/comment
  // (Niveau 1), qui restent dans le Dialog générique ci-dessous.
  const [approveTarget, setApproveTarget] = useState<Approval | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-approvals"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: { data: Approval[]; total: number } }>("/approvals/my");
      return res.data.data;
    },
  });

  const respond = useMutation({
    mutationFn: (vars: { id: string; action: RespondAction | "approve"; comment?: string }) =>
      apiClient.post(`/approvals/${vars.id}/respond`, { action: vars.action, comment: vars.comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-approvals"] });
      setDialogApproval(null);
      setComment("");
      toast.success(t("clientPortal.approvals.respondSuccess"));
    },
    // Without this, a failed respond (network, 403, already-actioned) left the
    // dialog open with no feedback — the client re-clicked "Confirm" blindly.
    onError: (error) => {
      const message = getServerErrorMessage(error) ?? t("clientPortal.approvals.respondError");
      const requestId = getServerRequestId(error);
      toast.error(requestId ? `${message} (ref. ${requestId})` : message);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-muted-foreground text-center py-20">{t("errors.loadFailed")}</p>
    );
  }

  const approvals = data?.data ?? [];

  const openDialog = (a: Approval, act: RespondAction) => {
    setDialogApproval(a);
    setAction(act);
    setComment("");
  };

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold text-ink">{t("clientPortal.approvals.title")}</h1>

      {approvals.length === 0 && (
        <Card className="rounded-3xl border border-border">
          <CardContent className="py-16 text-center text-muted-foreground">
            <ClipboardCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
            {t("clientPortal.approvals.empty")}
          </CardContent>
        </Card>
      )}

      {approvals.map((a) => (
        <Card key={a.id} className="rounded-3xl border border-border shadow-soft">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg">{a.title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {format(new Date(a.createdAt), "d MMMM yyyy", { locale: fr })}
                {a.dueDate && (
                  <> · {t("clientPortal.approvals.due")} {format(new Date(a.dueDate), "d MMMM yyyy", { locale: fr })}</>
                )}
              </p>
            </div>
            <Badge className={getApprovalStatusBadgeClass(a.status)}>
              {t(`clientPortal.approvals.statuses.${a.status}`, a.status)}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
            {a.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {a.attachments.map((att) => (
                  <a
                    key={att.id}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline"
                  >
                    {att.name}
                  </a>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {a.status === "PENDING" && (
                <>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => setApproveTarget(a)}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" /> {t("clientPortal.approvals.dialogApprove")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => openDialog(a, "reject")}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> {t("clientPortal.approvals.dialogReject")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openDialog(a, "comment")}
                  >
                    <MessageSquare className="h-4 w-4 mr-1" /> {t("clientPortal.approvals.dialogComment")}
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTimelineApproval(a)}
              >
                <Clock className="h-4 w-4 mr-1" /> {t("clientPortal.approvals.viewTimeline")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!dialogApproval} onOpenChange={(o) => !o && setDialogApproval(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "reject"
                ? t("clientPortal.approvals.dialogReject")
                : t("clientPortal.approvals.dialogComment")}
              {" : "}{dialogApproval?.title}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder={
              action === "reject"
                ? t("clientPortal.approvals.rejectReason")
                : t("clientPortal.approvals.yourComment")
            }
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            required={action === "comment"}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogApproval(null)}>{t("common.cancel")}</Button>
            <Button
              className={action === "reject" ? "bg-red-600 hover:bg-red-700 text-white" : ""}
              onClick={() =>
                dialogApproval &&
                respond.mutate({ id: dialogApproval.id, action, comment: comment || undefined })
              }
              disabled={respond.isPending || (action === "comment" && !comment.trim())}
            >
              {respond.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={!!approveTarget}
        onOpenChange={(open) => !open && setApproveTarget(null)}
        onConfirm={() => {
          if (!approveTarget) return;
          respond.mutate({ id: approveTarget.id, action: "approve" as const });
        }}
        isLoading={respond.isPending}
        icon={CheckCircle}
        title={`${t("clientPortal.approvals.dialogApprove")} : ${approveTarget?.title ?? ""}`}
        description={t(
          "clientPortal.approvals.confirmApproveDesc",
          "Cette approbation est irréversible et clôt la validation de cette demande. Vérifiez bien les pièces jointes et le contenu avant de confirmer."
        )}
        checkboxLabel={t(
          "clientPortal.approvals.approveCheckboxLabel",
          "Je confirme avoir vérifié le contenu et les pièces jointes de cette demande."
        )}
        confirmLabel={t("common.confirm")}
        cancelLabel={t("common.cancel")}
      />

      <Dialog open={!!timelineApproval} onOpenChange={(o) => !o && setTimelineApproval(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t("clientPortal.approvals.timelineTitle")}: {timelineApproval?.title}
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
                  {entry.user && <p className="text-sm text-muted-foreground mb-1">{t("common.by", "Par")} {entry.user.name}</p>}
                  {entry.comment && <p className="text-sm">{entry.comment}</p>}
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground">{t("clientPortal.approvals.noTimelineEntries")}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTimelineApproval(null)}>
              {t("common.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}