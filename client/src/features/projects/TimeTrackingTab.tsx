import { useState } from "react";
import { formatNumber } from "@/utils/format";
import { formatDate } from "@/utils/format";
import { useTranslation } from "react-i18next";
import { useTimeEntries, useTimeSummary, useMyTimeSummary, useCreateTimeEntry } from "@/hooks/useTimeEntries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Plus, X } from "lucide-react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  projectId: string;
  budget?: string | null;
  tasks?: Array<{ id: string; title: string }>;
  readOnly?: boolean;
  // "freelancer" shows the user's own hours × their own hourlyRate ("amount due"),
  // never the client budget/TJM — that's a margin figure kept ADMIN/MANAGER-only.
  mode?: "admin" | "freelancer";
}

function formatMinutes(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function parseBudgetTND(budget?: string | null): number | null {
  if (!budget) return null;
  const match = budget.match(/(\d[\d\s,.]*)/);
  if (!match) return null;
  const num = parseFloat(match[1].replace(/[\s,]/g, ""));
  return isNaN(num) ? null : num;
}

export function TimeTrackingTab({ projectId, budget, tasks = [], readOnly = false, mode = "admin" }: Props) {
  const { t } = useTranslation();
  const isFreelancerMode = mode === "freelancer";
  const { data: entriesData, isLoading: loadingEntries } = useTimeEntries(projectId);
  const { data: summary, isLoading: loadingSummary } = useTimeSummary(projectId, !isFreelancerMode);
  const { data: mySummary, isLoading: loadingMySummary } = useMyTimeSummary(projectId, isFreelancerMode);
  const { mutate: createEntry, isPending } = useCreateTimeEntry(projectId);

  const [showForm, setShowForm] = useState(false);
  const [taskId, setTaskId] = useState("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    const totalMinutes = (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0);
    if (totalMinutes < 1) return;
    createEntry(
      { taskId: taskId || undefined, description: description.trim() || undefined, minutes: totalMinutes, date },
      {
        onSuccess: () => {
          setShowForm(false);
          setHours("");
          setMinutes("");
          setDescription("");
          setTaskId("");
        },
      }
    );
  };

  const budgetTND = parseBudgetTND(budget);
  const totalHours = summary?.totalHours ?? 0;
  const implicitTJM = budgetTND && totalHours > 0
    ? Math.round(budgetTND / (totalHours / 8))
    : null;

  const chartData = (summary?.byUser ?? []).map((u) => ({
    name: u.userName.split(" ")[0],
    heures: Math.round((u.totalMinutes / 60) * 10) / 10,
  }));

  return (
    <div className="space-y-6">
      {/* Summary */}
      {isFreelancerMode ? (
        <div className="grid grid-cols-2 gap-4">
          <Card className="rounded-2xl border border-border shadow-none">
            <CardContent className="pt-5 px-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{t("common.total")}</p>
              <p className="text-2xl font-bold text-ink">
                {loadingMySummary ? "…" : `${mySummary?.totalHours ?? 0}h`}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border shadow-none">
            <CardContent className="pt-5 px-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Montant qui vous est dû</p>
              <p className="text-2xl font-bold text-ink">
                {loadingMySummary
                  ? "…"
                  : mySummary?.amountDue !== null && mySummary?.amountDue !== undefined
                    ? `${formatNumber(mySummary.amountDue)} TND`
                    : "—"}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="rounded-2xl border border-border shadow-none">
              <CardContent className="pt-5 px-5 pb-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{t("common.total")}</p>
                <p className="text-2xl font-bold text-ink">
                  {loadingSummary ? "…" : `${summary?.totalHours ?? 0}h`}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border border-border shadow-none">
              <CardContent className="pt-5 px-5 pb-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Membres</p>
                <p className="text-2xl font-bold text-ink">
                  {loadingSummary ? "…" : (summary?.byUser.length ?? 0)}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border border-border shadow-none">
              <CardContent className="pt-5 px-5 pb-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Budget</p>
                <p className="text-2xl font-bold text-ink">
                  {budgetTND ? `${formatNumber(budgetTND)} TND` : "—"}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border border-border shadow-none">
              <CardContent className="pt-5 px-5 pb-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">TJM implicite</p>
                <p className="text-2xl font-bold text-ink">
                  {implicitTJM ? `${formatNumber(implicitTJM)} TND` : "—"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <Card className="rounded-2xl border border-border shadow-none">
              <CardHeader className="px-5 pt-5 pb-2">
                <CardTitle className="text-sm font-semibold">Répartition par membre</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => [`${v}h`, "Heures"]} />
                      <Bar dataKey="heures" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Log Time Form */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Saisies de temps</h3>
        {!readOnly && !showForm && (
          <Button size="sm" onClick={() => setShowForm(true)} className="h-8 text-xs gap-1">
            <Plus className="h-3.5 w-3.5" />
            Saisir du temps
          </Button>
        )}
      </div>

      {!readOnly && showForm && (
        <Card className="rounded-2xl border border-border shadow-none">
          <CardContent className="pt-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Heures</Label>
                <Input
                  type="number"
                  min={0}
                  max={24}
                  placeholder="0"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Minutes</Label>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  step={15}
                  placeholder="0"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            {tasks.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Tâche (optionnel)</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                >
                  <option value="">— Aucune —</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Description (optionnel)</Label>
              <Input
                placeholder="Ce que vous avez travaillé..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowForm(false)}
                className="gap-1 h-8 text-xs"
              >
                <X className="h-3.5 w-3.5" />
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isPending || ((parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0) < 1)}
                className="h-8 text-xs"
              >
                <Clock className="h-3.5 w-3.5 mr-1" />
                Enregistrer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entries list */}
      {loadingEntries ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
        </div>
      ) : entriesData && entriesData.data.length > 0 ? (
        <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
          {entriesData.data.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{entry.user.name}</p>
                {entry.task && (
                  <p className="text-xs text-muted-foreground truncate">{entry.task.title}</p>
                )}
                {entry.description && (
                  <p className="text-xs text-muted-foreground truncate">{entry.description}</p>
                )}
              </div>
              <div className="text-right shrink-0 ml-4">
                <p className="text-sm font-semibold text-ink">{formatMinutes(entry.minutes)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(entry.date)}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground py-8">
          Aucune saisie de temps pour ce projet.
        </p>
      )}
    </div>
  );
}
