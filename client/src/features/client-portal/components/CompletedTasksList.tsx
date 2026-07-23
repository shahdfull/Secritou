// SEC-061 (rapport Product Owner, §7 constat P3, session 2026-07-19) : le CLIENT ne voyait son
// projet qu'à travers la timeline synthétique en 7 étapes (ProjectTimeline.tsx) et le brief —
// jamais le détail des tâches, point de friction potentiel sur la confiance client pour des
// projets longs. Décision du porteur : vue simplifiée listant les tâches DONE uniquement (titre +
// date), pas le détail complet (assignee/description/priorité restent non exposés — la
// confidentialité interne du reste du module Task n'est pas remise en cause).
import { CheckCircle2 } from "lucide-react";
import { formatDate } from "@/utils/format";
import type { CompletedTask } from "@/api/projects.api";

// SEC-091: no longer fetches its own data — tasks/isLoading come from the parent's single batched
// usePortalSummaries call (ProjectsClientPage.tsx), which covers every visible card in one
// request instead of one independent query per card.
export function CompletedTasksList({ tasks, isLoading }: { tasks: CompletedTask[] | undefined; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-5 w-full bg-gray-100 rounded" />
        ))}
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Ce qui a été livré
      </h3>
      <ul className="space-y-2">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              <span className="truncate text-ink">{task.title}</span>
            </span>
            {task.completedAt && (
              <span className="text-xs text-muted-foreground shrink-0">{formatDate(task.completedAt)}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
