// Mobile-responsive: updated 2026-06-29
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Lock } from "lucide-react";
import { projectsApi, TimelineStep } from "@/api/projects.api";
import { formatDate } from "@/utils/format";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProjectTimeline(projectId: string) {
  return useQuery({
    queryKey: ["project-timeline", projectId],
    queryFn: () => projectsApi.getTimelineStatus(projectId),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

// ---------------------------------------------------------------------------
// Step component
// ---------------------------------------------------------------------------

function TimelineStepItem({ step, isLast }: { step: TimelineStep; isLast: boolean }) {
  const isDone = step.status === "done";
  const isPending = step.status === "pending";
  const isLocked = step.status === "locked";

  return (
    <div className="flex gap-4">
      {/* Icon + connector */}
      <div className="flex flex-col items-center">
        <div
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all",
            isDone
              ? "border-green-500 bg-green-50 text-green-600"
              : isPending
              ? "border-orange-400 bg-orange-50 text-orange-500 animate-pulse"
              : "border-gray-200 bg-gray-50 text-gray-300",
          ].join(" ")}
        >
          {isDone ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : isPending ? (
            <Clock className="h-5 w-5" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
        </div>
        {!isLast && (
          <div
            className={[
              "mt-1 w-0.5 flex-1 min-h-[28px]",
              isDone ? "bg-green-300" : "bg-gray-200",
            ].join(" ")}
          />
        )}
      </div>

      {/* Content */}
      <div
        className={[
          "pb-6 pt-1 flex-1 min-w-0",
          isPending ? "rounded-lg border border-orange-200 bg-orange-50/40 px-3 -ml-1" : "",
        ].join(" ")}
      >
        <p
          className={[
            "text-sm font-semibold leading-tight",
            isDone ? "text-gray-800" : isPending ? "text-orange-700" : "text-gray-400",
          ].join(" ")}
        >
          {step.label}
        </p>
        {isDone && step.date && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatDate(step.date)}
          </p>
        )}
        {isPending && (
          <p className="mt-0.5 text-xs text-orange-500 font-medium">En attente</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ProjectTimeline({ projectId }: { projectId: string }) {
  const { data: steps, isLoading, isError } = useProjectTimeline(projectId);

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="h-9 w-9 rounded-full bg-gray-200 shrink-0" />
            <div className="flex-1 pt-2 space-y-1">
              <div className="h-3 w-40 bg-gray-200 rounded" />
              <div className="h-2 w-20 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError || !steps) {
    return (
      <p className="text-sm text-muted-foreground">
        Impossible de charger la timeline.
      </p>
    );
  }

  const doneCount = steps.filter((s) => s.status === "done").length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Avancement du projet
        </h3>
        <span className="text-xs font-medium text-muted-foreground">
          {doneCount}/{steps.length} étapes
        </span>
      </div>
      {/* overflow-x-auto guards against horizontal overflow on narrow phones
          (long step labels / dates) without breaking the surrounding layout. */}
      <div className="overflow-x-auto">
        {steps.map((step, i) => (
          <TimelineStepItem key={step.key} step={step} isLast={i === steps.length - 1} />
        ))}
      </div>
    </div>
  );
}
