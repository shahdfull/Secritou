import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/utils/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, History, RotateCcw } from "lucide-react";
import {
  useCommissionSplits,
  useSetCommissionSplits,
  useResetSplitToAuto,
  useCommissionSplitHistory,
  useSetPayoutBudget,
} from "@/hooks/useCommissions";
import { usersApi } from "@/api/users.api";

interface ProjectCommissionSplitTabProps {
  projectId: string;
}

interface EditableRow {
  partnerId: string;
  ratePct: string;
}

export function ProjectCommissionSplitTab({ projectId }: ProjectCommissionSplitTabProps) {
  const { t } = useTranslation();
  const { data: splitState, isLoading } = useCommissionSplits(projectId);
  const setSplitsMutation = useSetCommissionSplits(projectId);
  const resetToAutoMutation = useResetSplitToAuto(projectId);
  const setPayoutBudgetMutation = useSetPayoutBudget(projectId);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [rows, setRows] = useState<EditableRow[] | null>(null);
  const [payoutBudgetInput, setPayoutBudgetInput] = useState<string | null>(null);

  const { data: usersResult } = useQuery({
    queryKey: ["users", "forCommissionSplitTab"],
    queryFn: () => usersApi.getUsers({ page: 1, pageSize: 200 }),
    staleTime: 5 * 60_000,
  });
  const partnerNameById = useMemo(() => {
    const map = new Map<string, string>();
    (usersResult?.data ?? []).forEach((u) => map.set(u.id, u.name));
    return map;
  }, [usersResult?.data]);
  const assignablePartners = useMemo(
    () => (usersResult?.data ?? []).filter((u) => u.role !== "CLIENT"),
    [usersResult?.data]
  );

  const historyQuery = useCommissionSplitHistory(projectId, historyOpen);

  const editableRows = rows ?? (splitState?.splits.map((s) => ({ partnerId: s.partnerId, ratePct: String(s.ratePct) })) ?? []);

  const startEditing = () => {
    setRows(splitState?.splits.map((s) => ({ partnerId: s.partnerId, ratePct: String(s.ratePct) })) ?? []);
  };

  const cancelEditing = () => setRows(null);

  const updateRow = (index: number, patch: Partial<EditableRow>) => {
    setRows((current) => {
      const base = current ?? editableRows;
      return base.map((row, i) => (i === index ? { ...row, ...patch } : row));
    });
  };

  const removeRow = (index: number) => {
    setRows((current) => {
      const base = current ?? editableRows;
      return base.filter((_, i) => i !== index);
    });
  };

  const addRow = () => {
    setRows((current) => {
      const base = current ?? editableRows;
      const usedIds = new Set(base.map((r) => r.partnerId));
      const nextPartner = assignablePartners.find((p) => !usedIds.has(p.id));
      return [...base, { partnerId: nextPartner?.id ?? "", ratePct: "" }];
    });
  };

  const handleSave = () => {
    const parsed = editableRows
      .filter((r) => r.partnerId)
      .map((r) => ({ partnerId: r.partnerId, ratePct: Number(r.ratePct) }));
    setSplitsMutation.mutate(parsed, { onSuccess: () => setRows(null) });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isAuto = splitState?.commissionSplitMode === "AUTO";
  const isEditing = rows !== null;
  const isEditingBudget = payoutBudgetInput !== null;

  const startEditingBudget = () => {
    const current = splitState?.payoutBudget;
    const suggested = splitState?.suggestedPayoutBudget;
    // RG-006 : la suggestion à 65% n'est proposée que si aucune enveloppe n'est déjà fixée —
    // une valeur existante n'est jamais écrasée silencieusement par la suggestion.
    setPayoutBudgetInput(current !== null && current !== undefined ? String(current) : suggested !== null && suggested !== undefined ? String(suggested) : "");
  };

  const handleSaveBudget = () => {
    const trimmed = (payoutBudgetInput ?? "").trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    setPayoutBudgetMutation.mutate(parsed, { onSuccess: () => setPayoutBudgetInput(null) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Badge variant={isAuto ? "outline" : "secondary"}>
            {isAuto
              ? t("commissions.modeAuto", "Automatique")
              : t("commissions.modeManual", "Personnalisé")}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => setHistoryOpen(true)}>
            <History className="h-3.5 w-3.5" />
            {t("commissions.history", "Historique")}
          </Button>
          {!isAuto && (
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setResetDialogOpen(true)}>
              <RotateCcw className="h-3.5 w-3.5" />
              {t("commissions.resetToAuto", "Revenir au calcul automatique")}
            </Button>
          )}
        </div>
      </div>

      {splitState?.commissionSplitDesynced && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          {t(
            "commissions.desyncedNotice",
            "Un freelancer a été assigné/retiré depuis le dernier ajustement manuel — vérifiez la répartition."
          )}
        </p>
      )}

      <Card className="rounded-2xl border border-border shadow-none">
        <CardHeader className="px-5 pt-5 pb-1 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            {t("commissions.payoutBudgetTitle", "Enveloppe de rémunération")}
          </CardTitle>
          {!isEditingBudget && (
            <Button size="sm" variant="outline" className="text-xs" onClick={startEditingBudget}>
              {t("commissions.editSplits", "Modifier")}
            </Button>
          )}
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-3">
          {!isEditingBudget && (
            <p className="text-sm text-ink">
              {splitState?.payoutBudget !== null && splitState?.payoutBudget !== undefined
                ? `${splitState.payoutBudget} TND`
                : t("commissions.payoutBudgetNotSet", "Non fixée")}
            </p>
          )}
          {isEditingBudget && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step="0.001"
                  className="h-9 w-40 rounded-md border border-input bg-background px-2 text-sm"
                  value={payoutBudgetInput ?? ""}
                  onChange={(e) => setPayoutBudgetInput(e.target.value)}
                />
                <span className="text-sm text-muted-foreground">TND</span>
              </div>
              {splitState?.suggestedPayoutBudget !== null && splitState?.suggestedPayoutBudget !== undefined && (
                <p className="text-xs text-muted-foreground">
                  {t(
                    "commissions.payoutBudgetSuggestion",
                    "Suggestion : 65% du montant de la proposition acceptée ({{amount}} TND) — à valider, jamais appliquée automatiquement.",
                    { amount: splitState.suggestedPayoutBudget }
                  )}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" className="text-xs" onClick={() => setPayoutBudgetInput(null)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  size="sm"
                  className="text-xs"
                  onClick={handleSaveBudget}
                  disabled={setPayoutBudgetMutation.isPending}
                >
                  {setPayoutBudgetMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                  {t("common.save", "Enregistrer")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-border shadow-none">
        <CardHeader className="px-5 pt-5 pb-1 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            {t("commissions.splitsTitle", "Répartition de commission")}
          </CardTitle>
          {!isEditing && (
            <Button size="sm" variant="outline" className="text-xs" onClick={startEditing}>
              {t("commissions.editSplits", "Modifier")}
            </Button>
          )}
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-3">
          {editableRows.length === 0 && !isEditing && (
            <p className="text-sm text-muted-foreground">
              {t("commissions.noSplitsYet", "Aucune répartition de commission configurée pour le moment.")}
            </p>
          )}

          {editableRows.map((row, index) => (
            <div key={index} className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <select
                    className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                    value={row.partnerId}
                    onChange={(e) => updateRow(index, { partnerId: e.target.value })}
                  >
                    <option value="" disabled>
                      {t("commissions.selectPartner", "Choisir un associé")}
                    </option>
                    {assignablePartners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    className="h-9 w-24 rounded-md border border-input bg-background px-2 text-sm"
                    value={row.ratePct}
                    onChange={(e) => updateRow(index, { ratePct: e.target.value })}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                  <Button size="sm" variant="ghost" className="text-xs text-destructive" onClick={() => removeRow(index)}>
                    {t("common.remove", "Retirer")}
                  </Button>
                </>
              ) : (
                <div className="flex w-full items-center justify-between py-1">
                  <span className="text-sm text-ink">{partnerNameById.get(row.partnerId) ?? row.partnerId.slice(0, 8)}</span>
                  <span className="text-sm font-medium text-ink">{row.ratePct}%</span>
                </div>
              )}
            </div>
          ))}

          {isEditing && (
            <div className="flex items-center justify-between pt-2">
              <Button size="sm" variant="ghost" className="text-xs" onClick={addRow}>
                {t("commissions.addPartner", "Ajouter un associé")}
              </Button>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" className="text-xs" onClick={cancelEditing}>
                  {t("common.cancel")}
                </Button>
                <Button size="sm" className="text-xs" onClick={handleSave} disabled={setSplitsMutation.isPending}>
                  {setSplitsMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                  {t("common.save", "Enregistrer")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("commissions.confirmResetTitle", "Revenir au calcul automatique ?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "commissions.confirmResetDesc",
                "La répartition personnalisée actuelle sera remplacée par le calcul automatique par pôle/mission."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setResetDialogOpen(false)}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                resetToAutoMutation.mutate();
                setResetDialogOpen(false);
              }}
            >
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("commissions.history", "Historique")}</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-3">
            {historyQuery.isLoading && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!historyQuery.isLoading && (historyQuery.data?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">
                {t("commissions.noHistory", "Aucun historique pour ce projet.")}
              </p>
            )}
            {historyQuery.data?.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {entry.trigger === "AUTO_RECALC" && t("commissions.triggerAuto", "Recalcul automatique")}
                    {entry.trigger === "MANUAL_EDIT" && t("commissions.triggerManual", "Édition manuelle")}
                    {entry.trigger === "MODE_RESET_TO_AUTO" && t("commissions.triggerReset", "Retour au mode automatique")}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</span>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {entry.newSplits.map((s) => (
                    <span key={s.partnerId} className="mr-3">
                      {partnerNameById.get(s.partnerId) ?? s.partnerId.slice(0, 8)}: {s.ratePct}%
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setHistoryOpen(false)}>{t("common.close", "Fermer")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
