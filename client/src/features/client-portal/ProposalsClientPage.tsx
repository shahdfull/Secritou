import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/utils/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import apiClient from "@/api/axios";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { CheckCircle, XCircle, FileText } from "lucide-react";

type Proposal = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  version: number;
  amount: number | null;
  currency: string;
  expiresAt: string | null;
  createdAt: string;
  sections: { id: string; title: string; content: string | null; orderIndex: number }[];
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-primary-soft text-primary-strong",
  VIEWED: "bg-primary-soft text-primary-strong",
  ACCEPTED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-700",
  EXPIRED: "bg-accent-soft text-accent-foreground",
};

export function ProposalsClientPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id?: string }>();
  const [selected, setSelected] = useState<Proposal | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [comment, setComment] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["my-proposals"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: { data: Proposal[]; total: number } }>("/proposals/my");
      return res.data.data;
    },
  });

  useEffect(() => {
    if (id && data) {
      const proposal = data.data?.find((p) => p.id === id);
      if (proposal) {
        setSelected(proposal);
      }
    }
  }, [id, data]);

  const respond = useMutation({
    mutationFn: (vars: { id: string; action: "accept" | "reject"; comment?: string; expectedVersion?: number }) =>
      apiClient.post(`/proposals/${vars.id}/respond`, {
        action: vars.action,
        comment: vars.comment,
        // Send the version the client actually reviewed so the server can reject a stale
        // acceptance (proposal edited since it was loaded).
        expectedVersion: vars.expectedVersion,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-proposals"] });
      setSelected(null);
      setRejectDialogOpen(false);
      setComment("");
    },
    onError: (error: any) => {
      if (error?.response?.data?.error?.code === "PROPOSAL_VERSION_MISMATCH") {
        // The proposal changed since it was loaded : refetch and ask the client to review again.
        queryClient.invalidateQueries({ queryKey: ["my-proposals"] });
        setSelected(null);
        toast.error(t("clientPortal.proposals.versionMismatch"));
        return;
      }
      toast.error(t("clientPortal.proposals.responseFailed"));
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const proposals = data?.data ?? [];

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold text-ink">{t("clientPortal.proposals.title")}</h1>

      {proposals.length === 0 && (
        <Card className="rounded-3xl border border-border">
          <CardContent className="py-16 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
            {t("clientPortal.proposals.empty")}
          </CardContent>
        </Card>
      )}

      {proposals.map((p) => (
        <Card
          key={p.id}
          className="rounded-3xl border border-border shadow-soft cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setSelected(p)}
        >
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg">{p.title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {format(new Date(p.createdAt), "d MMMM yyyy", { locale: fr })}
              </p>
            </div>
            <Badge className={STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-700"}>
              {t(`clientPortal.proposals.statuses.${p.status}`, p.status)}
            </Badge>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-xl font-semibold">
              {p.amount != null
                ? formatCurrency(p.amount, p.currency)
                : ":"}
            </span>
            {p.status === "SENT" || p.status === "VIEWED" ? (
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <Button
                  size="sm"
                  className="bg-ink hover:bg-ink/90 text-white rounded-full"
                  onClick={() => respond.mutate({ id: p.id, action: "accept", expectedVersion: p.version })}
                  disabled={respond.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-1" /> {t("clientPortal.proposals.accept")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  onClick={() => { setSelected(p); setRejectDialogOpen(true); }}
                  disabled={respond.isPending}
                >
                  <XCircle className="h-4 w-4 mr-1" /> {t("clientPortal.proposals.reject")}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}

      {/* Detail dialog */}
      <Dialog open={!!selected && !rejectDialogOpen} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <Badge className={STATUS_COLORS[selected.status]}>{t(`clientPortal.proposals.statuses.${selected.status}`, selected.status)}</Badge>
              {selected.description && <p className="text-sm text-muted-foreground">{selected.description}</p>}
              {selected.sections.map((s) => (
                <div key={s.id} className="border rounded-xl p-4">
                  <h3 className="font-semibold mb-1">{s.title}</h3>
                  {s.content && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{s.content}</p>}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={(o) => { if (!o) { setRejectDialogOpen(false); setComment(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("clientPortal.proposals.rejectTitle")}</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder={t("clientPortal.proposals.rejectReason")}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white rounded-full"
              onClick={() => selected && respond.mutate({ id: selected.id, action: "reject", comment })}
              disabled={respond.isPending}
            >
              {t("clientPortal.proposals.confirmReject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
