import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import apiClient from "@/api/axios";
import { ratingsApi, type Rating } from "@/api/ratings.api";
import { getProjectStatusBadgeClass, getTaskStatusBadgeClass } from "@/utils/statusColors";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import {
  CheckCircle2, Clock, FolderOpen, Star, TrendingUp, Info, MessageSquare, AlertCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

type Task = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  priority: string;
  project: { id: string; name: string } | null;
};

type Project = {
  id: string;
  name: string;
  status: string;
  currentStep: number;
};

type Profile = {
  id: string;
  rating: number | null;
  reviewCount: number;
  availability: boolean;
  bio?: string | null;
  skills: { name: string }[];
};

function KpiSkeleton() {
  return (
    <Card className="rounded-2xl border border-border shadow-soft">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-10" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}

function EmptyTasks() {
  const { t } = useTranslation();
  return (
    <div className="py-6 text-center space-y-3">
      <p className="text-sm text-muted-foreground">{t("freelancerDashboard.noTasksHint")}</p>
      <Button asChild size="sm" variant="outline">
        <Link to="/app/settings?tab=freelancer-profile">{t("freelancerDashboard.completeProfile")}</Link>
      </Button>
    </div>
  );
}

function EmptyProjects() {
  const { t } = useTranslation();
  return (
    <div className="py-6 text-center">
      <p className="text-sm text-muted-foreground">{t("freelancerDashboard.noProjectsHint")}</p>
    </div>
  );
}

function sortActiveTasks(tasks: Task[]): Task[] {
  const now = new Date();
  const overdue = tasks
    .filter((t) => t.dueDate && new Date(t.dueDate) < now)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
  const upcoming = tasks
    .filter((t) => !t.dueDate || new Date(t.dueDate) >= now)
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  return [...overdue, ...upcoming];
}

export function FreelancerDashboardPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ["my-tasks"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: { data: Task[]; total: number } }>("/tasks");
      return res.data.data;
    },
  });

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ["my-projects"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: { data: Project[]; total: number } }>("/projects");
      return res.data.data;
    },
  });

  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ["my-freelancer-profile"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Profile }>("/freelancers/me");
      return res.data.data;
    },
  });

  const { data: ratingsData } = useQuery<Rating[]>({
    queryKey: ["my-ratings", profileData?.id],
    queryFn: () => ratingsApi.getByFreelancerId(profileData!.id),
    enabled: !!profileData?.id,
    staleTime: 2 * 60 * 1000,
  });

  const toggleAvailability = useMutation({
    mutationFn: async (availability: boolean) => {
      await apiClient.put("/freelancers/me", { availability });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-freelancer-profile"] });
    },
    onError: () => toast.error(t("common.error")),
  });

  const tasks: Task[] = tasksData?.data ?? [];
  const projects: Project[] = projectsData?.data ?? [];
  const profile = profileData;

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const activeTasks = tasks.filter((t) => t.status !== "DONE");
  const sortedActiveTasks = sortActiveTasks(activeTasks);
  const inProgressTasks = tasks.filter((t) => t.status === "IN_PROGRESS");
  const overdueTasks = activeTasks.filter((t) => t.dueDate && new Date(t.dueDate) < now);
  const activeProjects = projects.filter((p) => p.status !== "COMPLETED");

  // Completion rate: current month only
  const monthTasks = tasks.filter((t) => {
    const updatedAt = (t as any).updatedAt ? new Date((t as any).updatedAt) : null;
    const createdAt = (t as any).createdAt ? new Date((t as any).createdAt) : null;
    const ref = updatedAt ?? createdAt;
    if (!ref) return true;
    return ref >= monthStart && ref <= monthEnd;
  });
  const monthDone = monthTasks.filter((t) => t.status === "DONE").length;
  const completionRate = monthTasks.length > 0 ? Math.round((monthDone / monthTasks.length) * 100) : null;

  // Last rating with a comment
  const lastRatingWithComment = ratingsData
    ?.filter((r) => r.comment)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  const TASK_PREVIEW = 5;
  const PROJECT_PREVIEW = 4;

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-ink">
          {t("freelancerDashboard.greeting", { name: user?.name?.split(" ")[0] ?? "" })}
        </h1>
        <p className="text-muted-foreground mt-1">{t("freelancerDashboard.subtitle")}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tasksLoading || projectsLoading ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : (
          <>
            <Card className="rounded-2xl border border-border shadow-soft">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-xl">
                    <Clock className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-ink">{inProgressTasks.length}</p>
                    <p className="text-xs text-muted-foreground">{t("freelancerDashboard.inProgress")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-border shadow-soft">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 rounded-xl">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-ink">{monthDone}</p>
                    <p className="text-xs text-muted-foreground">{t("freelancerDashboard.completedThisMonth")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-border shadow-soft">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-50 rounded-xl">
                    <FolderOpen className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-ink">{activeProjects.length}</p>
                    <p className="text-xs text-muted-foreground">{t("freelancerDashboard.activeProjects")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-border shadow-soft">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-50 rounded-xl">
                    <TrendingUp className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-ink">
                      {completionRate !== null ? `${completionRate}%` : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">{t("freelancerDashboard.completionRate")}</p>
                    <p className="text-[10px] text-muted-foreground/70 leading-tight mt-0.5">{t("freelancerDashboard.completionRateHint")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Active tasks — sorted: overdue first, then by due date asc */}
        <Card className="rounded-2xl border border-border shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                {t("freelancerDashboard.myTasks")}
                {!tasksLoading && overdueTasks.length > 0 && (
                  <Badge className="bg-red-100 text-red-700 text-xs">
                    {overdueTasks.length} {t("freelancerDashboard.overdue")}
                  </Badge>
                )}
              </span>
              {!tasksLoading && activeTasks.length > TASK_PREVIEW && (
                <Link to="/app/tasks" className="text-xs font-normal text-primary hover:underline">
                  {t("freelancerDashboard.seeAll")} ({activeTasks.length})
                </Link>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasksLoading ? (
              <ListSkeleton rows={4} />
            ) : activeTasks.length === 0 ? (
              <EmptyTasks />
            ) : (
              sortedActiveTasks.slice(0, TASK_PREVIEW).map((task) => {
                const isOverdue = task.dueDate && new Date(task.dueDate) < now;
                return (
                  <div
                    key={task.id}
                    className={`flex items-start justify-between gap-3 p-3 rounded-xl transition-colors ${
                      isOverdue
                        ? "bg-red-50/60 hover:bg-red-50"
                        : "bg-muted/40 hover:bg-muted/70"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{task.title}</p>
                      {task.project && (
                        <Link
                          to={`/app/projects/${task.project.id}`}
                          className="text-xs text-muted-foreground hover:text-primary truncate block"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {task.project.name}
                        </Link>
                      )}
                      {task.dueDate && (
                        <p className={`text-xs mt-0.5 ${isOverdue ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                          {isOverdue && "⚠ "}
                          {format(new Date(task.dueDate), "d MMM", { locale: fr })}
                        </p>
                      )}
                    </div>
                    <Badge className={`${getTaskStatusBadgeClass(task.status)} shrink-0 text-xs`}>
                      {t(`tasks.statuses.${task.status}`, task.status)}
                    </Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* My projects + rating */}
        <div className="space-y-4">
          {/* Projects */}
          <Card className="rounded-2xl border border-border shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center justify-between">
                {t("freelancerDashboard.myProjects")}
                {!projectsLoading && projects.length > PROJECT_PREVIEW && (
                  <Link to="/app/projects" className="text-xs font-normal text-primary hover:underline">
                    {t("freelancerDashboard.seeAll")} ({projects.length})
                  </Link>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {projectsLoading ? (
                <ListSkeleton rows={3} />
              ) : projects.length === 0 ? (
                <EmptyProjects />
              ) : (
                projects.slice(0, PROJECT_PREVIEW).map((project) => (
                  <Link
                    key={project.id}
                    to={`/app/projects/${project.id}`}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors"
                  >
                    <p className="text-sm font-medium text-ink truncate">{project.name}</p>
                    <Badge className={`${getProjectStatusBadgeClass(project.status)} shrink-0 text-xs`}>
                      {t(`projects.status.${project.status}`, project.status)}
                    </Badge>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          {/* Rating card */}
          {profileLoading ? (
            <Card className="rounded-2xl border border-border shadow-soft">
              <CardContent className="pt-5 pb-4 space-y-3">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-xl" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-7 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-5 w-16 rounded-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : profile ? (
            <Card className="rounded-2xl border border-border shadow-soft">
              <CardContent className="pt-5 pb-4 space-y-3">
                {/* Score row */}
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-yellow-50 rounded-xl shrink-0">
                    <Star className="h-6 w-6 text-yellow-500 fill-yellow-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-2xl font-bold text-ink leading-none">
                      {profile.rating != null ? Number(profile.rating).toFixed(1) : "—"}
                      <span className="text-base font-normal text-muted-foreground"> / 5</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {profile.reviewCount} {t("freelancerDashboard.reviews")}
                    </p>
                  </div>
                  {/* Availability with tooltip */}
                  <div className="flex items-center gap-2 shrink-0">
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={`text-xs font-medium cursor-default flex items-center gap-1 ${profile.availability ? "text-green-700" : "text-muted-foreground"}`}>
                            {profile.availability ? t("freelancerDashboard.available") : t("freelancerDashboard.unavailable")}
                            <Info className="h-3 w-3 text-muted-foreground/60" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-52 text-xs text-center">
                          {t("freelancerDashboard.availabilityTooltip")}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Switch
                      checked={profile.availability}
                      onCheckedChange={(v) => toggleAvailability.mutate(v)}
                      disabled={toggleAvailability.isPending}
                    />
                  </div>
                </div>

                {/* Last comment */}
                {lastRatingWithComment && (
                  <div className="bg-muted/40 rounded-xl px-3 py-2.5 space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
                      <MessageSquare className="h-3 w-3" />
                      {t("freelancerDashboard.lastReview")}
                    </div>
                    <p className="text-xs text-ink/80 italic line-clamp-3">
                      "{lastRatingWithComment.comment}"
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      — {lastRatingWithComment.ratedByUser?.name ?? t("freelancerDashboard.anonymous")},&nbsp;
                      {format(new Date(lastRatingWithComment.createdAt), "d MMM yyyy", { locale: fr })}
                    </p>
                  </div>
                )}

                {/* Link to full profile reviews */}
                {profile.id && (
                  <Link
                    to={`/app/freelancers/${profile.id}`}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Star className="h-3 w-3" />
                    {t("freelancerDashboard.seeReviews")}
                  </Link>
                )}

                {/* Skills */}
                {profile.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {profile.skills.slice(0, 6).map((s) => (
                      <Badge key={s.name} variant="outline" className="text-xs">
                        {s.name}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Profile completeness prompt */}
                {(!profile.bio || profile.skills.length === 0) && (
                  <Link
                    to="/app/settings?tab=freelancer-profile"
                    className="flex items-center gap-2 rounded-lg border border-dashed border-orange-300 bg-orange-50 px-3 py-2 text-xs text-orange-700 hover:bg-orange-100 transition-colors"
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {t("freelancerDashboard.completeProfile")}
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
