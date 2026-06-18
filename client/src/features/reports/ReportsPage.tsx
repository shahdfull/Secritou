import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateFilter, DateRange } from "@/components/DateFilter";
import { useLeads } from "@/hooks/useLeads";
import { useProjects } from "@/hooks/useProjects";
import { useMissions } from "@/hooks/useMissions";
import { FileText, FileSpreadsheet, Loader2, Users, Briefcase, Target } from "lucide-react";
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Lead } from "@/types/lead";
import type { Project } from "@/types/project";
import type { FreelancerMission } from "@/types/freelancer";
import { useVirtualizer } from "@tanstack/react-virtual";

const formatStatus = (status: string, lang: string = "fr"): string => {
  const statusMapFr: Record<string, string> = {
    // Lead statuses
    NEW: "Nouveau",
    CONTACTED: "Contacté",
    QUALIFIED: "Qualifié",
    PROPOSAL: "Proposition",
    WON: "Gagné",
    LOST: "Perdu",
    // Project statuses
    PLANNING: "Planification",
    IN_PROGRESS: "En cours",
    IN_REVIEW: "En révision",
    COMPLETED: "Complété",
    ON_HOLD: "En attente",
    CANCELLED: "Annulé",
    // Mission statuses
    OPEN: "Ouvert",
    ASSIGNED: "Assigné",
    ACTIVE: "Actif",
    COMPLETED_MISSION: "Complété",
    CLOSED: "Fermé",
    REVIEW: "Révision",
  };

  const statusMapEn: Record<string, string> = {
    // Lead statuses
    NEW: "New",
    CONTACTED: "Contacted",
    QUALIFIED: "Qualified",
    PROPOSAL: "Proposal",
    WON: "Won",
    LOST: "Lost",
    // Project statuses
    PLANNING: "Planning",
    IN_PROGRESS: "In Progress",
    IN_REVIEW: "In Review",
    COMPLETED: "Completed",
    ON_HOLD: "On Hold",
    CANCELLED: "Cancelled",
    // Mission statuses
    OPEN: "Open",
    ASSIGNED: "Assigned",
    ACTIVE: "Active",
    COMPLETED_MISSION: "Completed",
    CLOSED: "Closed",
    REVIEW: "Review",
  };

  const statusMap = lang === "en" ? statusMapEn : statusMapFr;
  return statusMap[status] || status;
};

export function ReportsPage() {
  const { i18n } = useTranslation();
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    return { from: thirtyDaysAgo, to: today };
  });

  const listParams = useMemo(() => ({ page: 1, pageSize: 500 }), []);
  const { data: leadsResult, isLoading: leadsLoading } = useLeads(listParams);
  const { data: projectsResult, isLoading: projectsLoading } = useProjects(listParams);
  const { data: missionsResult, isLoading: missionsLoading } = useMissions(listParams);
  const leads = useMemo(() => leadsResult?.data ?? [], [leadsResult?.data]);
  const projects = useMemo(() => projectsResult?.data ?? [], [projectsResult?.data]);
  const missions = useMemo(() => missionsResult?.data ?? [], [missionsResult?.data]);

  const isLoading = leadsLoading || projectsLoading || missionsLoading;
  const [isExporting, startExportTransition] = useTransition();

  const fromMs = dateRange.from ? dateRange.from.getTime() : null;
  const toMs = dateRange.to ? dateRange.to.getTime() : null;

  const filteredLeads = useMemo(
    () =>
      leads.filter((lead) => {
        const createdAtMs = new Date(lead.createdAt).getTime();
        return (fromMs == null || createdAtMs >= fromMs) && (toMs == null || createdAtMs <= toMs);
      }),
    [leads, fromMs, toMs]
  );

  const leadConversionRate = useMemo(() => {
    const total = filteredLeads.length;
    if (!total) return 0;
    const won = filteredLeads.reduce((acc, l) => (l.status === "WON" ? acc + 1 : acc), 0);
    return Math.round((won / total) * 100);
  }, [filteredLeads]);

  const filteredProjects = useMemo(
    () =>
      projects.filter((project) => {
        const createdAtMs = new Date(project.createdAt).getTime();
        return (fromMs == null || createdAtMs >= fromMs) && (toMs == null || createdAtMs <= toMs);
      }),
    [projects, fromMs, toMs]
  );

  const avgProjectCompletionRate = useMemo(() => {
    const total = filteredProjects.length;
    if (!total) return 0;
    const completed = filteredProjects.reduce((acc, p) => (p.status === "COMPLETED" ? acc + 1 : acc), 0);
    return Math.round((completed / total) * 100);
  }, [filteredProjects]);

  const filteredMissions = useMemo(
    () =>
      missions.filter((mission) => {
        const createdAtMs = new Date(mission.createdAt).getTime();
        return (fromMs == null || createdAtMs >= fromMs) && (toMs == null || createdAtMs <= toMs);
      }),
    [missions, fromMs, toMs]
  );

  const totalMissionBudget = useMemo(
    () => filteredMissions.reduce((sum, mission) => sum + Number(mission.budget ?? 0), 0),
    [filteredMissions]
  );

  const exportToPDF = useCallback(() => {
    startExportTransition(async () => {
      const { exportReportsPdf } = await import("./exportPdf");
      await exportReportsPdf({
        dateRange,
        leads: filteredLeads,
        projects: filteredProjects,
        missions: filteredMissions,
      });
    });
  }, [dateRange, filteredLeads, filteredProjects, filteredMissions, startExportTransition]);

  const exportToExcel = useCallback(() => {
    startExportTransition(async () => {
      const { exportReportsExcel } = await import("./exportExcel");
      await exportReportsExcel({
        leads: filteredLeads,
        projects: filteredProjects,
        missions: filteredMissions,
      });
    });
  }, [filteredLeads, filteredProjects, filteredMissions, startExportTransition]);

  const leadsScrollRef = useRef<HTMLDivElement | null>(null);
  const projectsScrollRef = useRef<HTMLDivElement | null>(null);
  const missionsScrollRef = useRef<HTMLDivElement | null>(null);

  const leadsVirtualizer = useVirtualizer({ count: filteredLeads.length, getScrollElement: () => leadsScrollRef.current, estimateSize: () => 44, overscan: 8 });
  const projectsVirtualizer = useVirtualizer({ count: filteredProjects.length, getScrollElement: () => projectsScrollRef.current, estimateSize: () => 44, overscan: 8 });
  const missionsVirtualizer = useVirtualizer({ count: filteredMissions.length, getScrollElement: () => missionsScrollRef.current, estimateSize: () => 44, overscan: 8 });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Rapports</h1>
          <p className="text-muted-foreground">Visualiser et exporter les rapports d'activite</p>
        </div>
        <div className="flex gap-2">
          <DateFilter value={dateRange} onChange={setDateRange} />
          <Button onClick={exportToPDF} variant="outline" disabled={isExporting}>
            <FileText className="h-4 w-4 mr-2" />
            {isExporting ? "Export..." : "Exporter PDF"}
          </Button>
          <Button onClick={exportToExcel} disabled={isExporting}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            {isExporting ? "Export..." : "Exporter Excel"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Rapport Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-4">
              <div className="text-2xl font-bold">{filteredLeads.length}</div>
              <div className="text-3xl font-bold text-primary">{leadConversionRate}%</div>
            </div>
            <CardDescription className="text-sm text-muted-foreground">Taux de conversion</CardDescription>
          </CardContent>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
            </Table>
            <div ref={leadsScrollRef} className="max-h-64 overflow-auto border-t">
              <div style={{ height: leadsVirtualizer.getTotalSize(), position: "relative" }}>
                {leadsVirtualizer.getVirtualItems().map((virtualRow) => {
                  const lead = filteredLeads[virtualRow.index] as Lead | undefined;
                  if (!lead) return null;
                  return (
                    <div
                      key={lead.id}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: virtualRow.size,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      className="grid grid-cols-2 px-4 items-center border-b h-11"
                    >
                      <div className="truncate">{lead.name}</div>
                      <div className="truncate">{formatStatus(lead.status, i18n.language)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Briefcase className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Rapport Projets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-4">
              <div className="text-2xl font-bold">{filteredProjects.length}</div>
              <div className="text-3xl font-bold text-primary">{avgProjectCompletionRate}%</div>
            </div>
            <CardDescription className="text-sm text-muted-foreground">Taux de completion</CardDescription>
          </CardContent>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
            </Table>
            <div ref={projectsScrollRef} className="max-h-64 overflow-auto border-t">
              <div style={{ height: projectsVirtualizer.getTotalSize(), position: "relative" }}>
                {projectsVirtualizer.getVirtualItems().map((virtualRow) => {
                  const project = filteredProjects[virtualRow.index] as Project | undefined;
                  if (!project) return null;
                  return (
                    <div
                      key={project.id}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: virtualRow.size,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      className="grid grid-cols-2 px-4 items-center border-b h-11"
                    >
                      <div className="truncate">{project.name}</div>
                      <div className="truncate">{formatStatus(project.status, i18n.language)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Target className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Rapport Missions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-4">
              <div className="text-2xl font-bold">{filteredMissions.length}</div>
              <div className="text-3xl font-bold text-green-600">{totalMissionBudget} TND</div>
            </div>
            <CardDescription className="text-sm text-muted-foreground">Budget total engagé</CardDescription>
          </CardContent>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
            </Table>
            <div ref={missionsScrollRef} className="max-h-64 overflow-auto border-t">
              <div style={{ height: missionsVirtualizer.getTotalSize(), position: "relative" }}>
                {missionsVirtualizer.getVirtualItems().map((virtualRow) => {
                  const mission = filteredMissions[virtualRow.index] as FreelancerMission | undefined;
                  if (!mission) return null;
                  return (
                    <div
                      key={mission.id}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: virtualRow.size,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      className="grid grid-cols-2 px-4 items-center border-b h-11"
                    >
                      <div className="truncate">{mission.title}</div>
                      <div className="truncate">{formatStatus(mission.status, i18n.language)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
