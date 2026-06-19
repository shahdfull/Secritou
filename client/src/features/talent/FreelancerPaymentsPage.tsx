import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, DollarSign, Clock } from "lucide-react";
import { useUnpaidMissions, useMarkMissionAsPaid } from "@/hooks/useMissions";
import type { FreelancerMission } from "@/types/freelancer";

const paymentStatusColors: Record<string, string> = {
  UNPAID: "bg-red-100 text-red-700",
  PARTIAL: "bg-yellow-100 text-yellow-700",
  PAID: "bg-green-100 text-green-700",
};

export function FreelancerPaymentsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useUnpaidMissions();
  const markAsPaid = useMarkMissionAsPaid();

  const [selectedMission, setSelectedMission] = useState<FreelancerMission | null>(null);
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");

  const missions = data?.data ?? [];

  function openPayDialog(mission: FreelancerMission) {
    const remaining = Number(mission.budget ?? 0) - Number(mission.paidAmount ?? 0);
    setPaidAmount(String(remaining > 0 ? remaining : ""));
    setPaymentNote("");
    setSelectedMission(mission);
  }

  function closeDialog() {
    setSelectedMission(null);
  }

  async function handlePay() {
    if (!selectedMission) return;
    const amount = parseFloat(paidAmount);
    if (isNaN(amount) || amount <= 0) return;
    await markAsPaid.mutateAsync({
      id: selectedMission.id,
      paidAmount: amount,
      paymentNote: paymentNote || undefined,
    });
    closeDialog();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="h-5 w-5 text-yellow-600" />
        <h2 className="text-lg font-semibold">
          {t("payments.pending", "Paiements en attente")}
        </h2>
        <Badge variant="secondary">{missions.length}</Badge>
      </div>

      {missions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("payments.allPaid", "Tous les freelancers ont été payés.")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {missions.map((mission) => {
            const budget = Number(mission.budget ?? 0);
            const paid = Number(mission.paidAmount ?? 0);
            const remaining = budget - paid;
            const pct = budget > 0 ? Math.round((paid / budget) * 100) : 0;
            return (
              <Card key={mission.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-medium leading-snug">
                      {mission.title}
                    </CardTitle>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${paymentStatusColors[mission.paymentStatus ?? "UNPAID"]}`}
                    >
                      {t(`payments.statuses.${mission.paymentStatus ?? "UNPAID"}`, mission.paymentStatus ?? "UNPAID")}
                    </span>
                  </div>
                  {mission.freelancer && (
                    <p className="text-xs text-muted-foreground">
                      {mission.freelancer.user.name}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-4">
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("payments.budget", "Budget")}</span>
                      <span className="font-medium">{budget.toLocaleString()} €</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("payments.paid", "Payé")}</span>
                      <span className="font-medium text-green-600">{paid.toLocaleString()} €</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("payments.remaining", "Restant")}</span>
                      <span className="font-medium text-red-600">{remaining.toLocaleString()} €</span>
                    </div>
                    {budget > 0 && (
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-green-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => openPayDialog(mission)}
                  >
                    <DollarSign className="mr-1.5 h-4 w-4" />
                    {t("payments.recordPayment", "Enregistrer paiement")}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedMission} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("payments.recordPayment", "Enregistrer paiement")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">{t("payments.amount", "Montant (€)")}</Label>
              <Input
                id="pay-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-note">{t("payments.note", "Note (optionnel)")}</Label>
              <Textarea
                id="pay-note"
                rows={2}
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder={t("payments.notePlaceholder", "Virement, chèque, etc.")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              {t("common.cancel", "Annuler")}
            </Button>
            <Button
              onClick={handlePay}
              disabled={markAsPaid.isPending || !paidAmount || parseFloat(paidAmount) <= 0}
            >
              {markAsPaid.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("payments.confirm", "Confirmer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
