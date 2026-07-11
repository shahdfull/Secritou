import { memo, useState } from "react";
import { formatDate } from "@/utils/format";
import { useNavigate } from "react-router-dom";
import { useHealthBoard } from "@/hooks/useHealthBoard";
import type { ProjectHealthItem } from "@/api/healthBoard.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle } from "lucide-react";
import { PoleSelect } from "@/components/common/PoleSelect";

type Filter = "all" | "red" | "orange";

const STATUS_LABEL: Record<string, string> = {
  PLANNING: "Planification",
  IN_PROGRESS: "En cours",
  REVIEW: "Révision",
};

function HealthDot({ score }: { score: ProjectHealthItem["healthScore"] }) {
  const cls =
    score === "red"
      ? "bg-red-500"
      : score === "orange"
      ? "bg-orange-400"
      : "bg-green-500";
  return <span className={`inline-block h-3 w-3 rounded-full ${cls} shrink-0`} />;
}

function DeadlineBadge({ item }: { item: ProjectHealthItem }) {
  if (!item.deadline) return <span className="text-xs text-muted-foreground">—</span>;
  const label = item.daysUntilDeadline !== null
    ? item.isOverdue
      ? `${Math.abs(item.daysUntilDeadline)}j retard`
      : `J-${item.daysUntilDeadline}`
    : formatDate(item.deadline);
  return (
    <Badge className={item.isOverdue ? "bg-red-100 text-red-700 text-xs" : "bg-muted text-muted-foreground text-xs"}>
      {label}
    </Badge>
  );
}

function ActivityBadge({ item }: { item: ProjectHealthItem }) {
  if (item.daysSinceLastActivity === null) return <span className="text-xs text-muted-foreground">—</span>;
  const label = item.daysSinceLastActivity === 0 ? "Aujourd'hui" : `Il y a ${item.daysSinceLastActivity}j`;
  return (
    <span className={`text-xs ${item.isStale ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
      {label}
    </span>
  );
}

const HealthBoardTable = memo(function HealthBoardTable({ items }: { items: ProjectHealthItem[] }) {
  const navigate = useNavigate();
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Score</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Projet</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Client</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Statut</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Progrès</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Deadline</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Activité</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Bloqués</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
              onClick={() => navigate(`/app/projects/${item.id}`)}
            >
              <td className="px-4 py-3">
                <HealthDot score={item.healthScore} />
              </td>
              <td className="px-4 py-3 font-medium text-ink max-w-[180px] truncate">{item.name}</td>
              <td className="px-4 py-3 text-muted-foreground max-w-[140px] truncate">{item.clientName}</td>
              <td className="px-4 py-3">
                <Badge variant="outline" className="text-xs">{STATUS_LABEL[item.status] ?? item.status}</Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">{item.progress}%</span>
                </div>
              </td>
              <td className="px-4 py-3"><DeadlineBadge item={item} /></td>
              <td className="px-4 py-3"><ActivityBadge item={item} /></td>
              <td className="px-4 py-3">
                {item.blockedTasksCount > 0 ? (
                  <Badge className="bg-orange-100 text-orange-700 text-xs">{item.blockedTasksCount}</Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

export function HealthBoardTab() {
  const [serviceId, setServiceId] = useState<string | undefined>(undefined);
  const { data, isLoading } = useHealthBoard(serviceId);
  const [filter, setFilter] = useState<Filter>("all");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end">
          <PoleSelect value={serviceId} onChange={setServiceId} />
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const items = data ?? [];
  const filtered = filter === "all" ? items : items.filter((i) => i.healthScore === filter);
  const criticalCount = items.filter((i) => i.healthScore === "red").length;
  const watchCount = items.filter((i) => i.healthScore === "orange").length;
  const allGreen = criticalCount === 0 && watchCount === 0;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {(
            [
              { value: "all", label: `Tous (${items.length})` },
              { value: "red", label: `🔴 Critiques (${criticalCount})` },
              { value: "orange", label: `🟠 À surveiller (${watchCount})` },
            ] as { value: Filter; label: string }[]
          ).map(({ value, label }) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "default" : "outline"}
              onClick={() => setFilter(value)}
              className="h-8 text-xs rounded-full"
            >
              {label}
            </Button>
          ))}
        </div>
        <PoleSelect value={serviceId} onChange={setServiceId} />
      </div>

      {allGreen && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm font-medium">
          <CheckCircle className="h-4 w-4" />
          Tous les projets sont dans les temps ✓
        </div>
      )}

      {filtered.length === 0 && !allGreen ? (
        <p className="text-center text-sm text-muted-foreground py-10">Aucun projet dans cette catégorie.</p>
      ) : (
        <HealthBoardTable items={filtered} />
      )}
    </div>
  );
}
