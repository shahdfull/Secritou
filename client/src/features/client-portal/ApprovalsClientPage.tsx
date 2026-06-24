import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import apiClient from "@/api/axios";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle, XCircle, MessageSquare, ClipboardCheck } from "lucide-react";

type Approval = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  createdAt: string;
  attachments: { id: string; name: string; url: string }[];
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  COMMENTED: "bg-blue-100 text-blue-700",
};

type RespondAction = "approve" | "reject" | "comment";

export function ApprovalsClientPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogApproval, setDialogApproval] = useState<Approval | null>(null);
  const [action, setAction] = useState<RespondAction>("comment");
  const [comment, setComment] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["my-approvals"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: { data: Approval[]; total: number } }>("/approvals/my");
      return res.data.data;
    },
  });

  const respond = useMutation({
    mutationFn: (vars: { id: string; action: RespondAction; comment?: string }) =>
      apiClient.post(`/approvals/${vars.id}/respond`, { action: vars.action, comment: vars.comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-approvals"] });
      setDialogApproval(null);
      setComment("");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
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
            <Badge className={STATUS_COLORS[a.status] ?? "bg-gray-100 text-gray-700"}>
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
            {a.status === "PENDING" && (
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => openDialog(a, "approve")}
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
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!dialogApproval} onOpenChange={(o) => !o && setDialogApproval(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "approve"
                ? t("clientPortal.approvals.dialogApprove")
                : action === "reject"
                ? t("clientPortal.approvals.dialogReject")
                : t("clientPortal.approvals.dialogComment")}
              {" : "}{dialogApproval?.title}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder={
              action === "approve"
                ? t("clientPortal.approvals.commentOptional")
                : action === "reject"
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
              className={
                action === "approve"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : action === "reject"
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : ""
              }
              onClick={() =>
                dialogApproval &&
                respond.mutate({ id: dialogApproval.id, action, comment: comment || undefined })
              }
              disabled={respond.isPending || (action === "comment" && !comment.trim())}
            >
              {t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
