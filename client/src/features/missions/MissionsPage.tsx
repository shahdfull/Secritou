import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MoreHorizontal,
  Search,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useMissions,
  useCreateMission,
  useUpdateMission,
  useApplyToMission,
  useDeleteMission,
} from "@/hooks/useMissions";
import type { FreelancerMission, MissionApplication } from "@/types/freelancer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useListParams } from "@/hooks/useListParams";
import { DataTablePagination } from "@/components/common/DataTablePagination";
import { useAuthStore } from "@/store/auth.store";
import { useTranslation } from "react-i18next";
import { missionsApi } from "@/api/missions.api";

const createMissionSchema = z.object({
  title: z.string().min(1, "Title required"),
  description: z.string().optional(),
  budget: z.coerce.number().positive().optional(),
});

const updateMissionSchema = createMissionSchema.extend({
  status: z
    .enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
    .optional(),
});

type CreateMissionForm = z.infer<typeof createMissionSchema>;
type UpdateMissionForm = z.infer<typeof updateMissionSchema>;

export function MissionsPage() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [applicationsSheetOpen, setApplicationsSheetOpen] = useState(false);
  const [editingMission, setEditingMission] = useState<FreelancerMission | null>(null);
  const [selectedMissionForApplications, setSelectedMissionForApplications] = useState<FreelancerMission | null>(null);
  const queryClient = useQueryClient();

  const { page, pageSize, orderBy, orderDir, params, setPage, updateParams } = useListParams(10);
  const { data: missionsResult, isLoading } = useMissions(params);
  const missions = missionsResult?.data ?? [];
  const total = missionsResult?.total ?? 0;
  const { data: applications } = useQuery({
    queryKey: ["missionApplications", selectedMissionForApplications?.id],
    queryFn: () => selectedMissionForApplications ? missionsApi.getApplications(selectedMissionForApplications.id) : Promise.resolve([]),
    enabled: !!selectedMissionForApplications,
  });
  const { mutate: createMission, isPending: isCreating } = useCreateMission();
  const { mutate: updateMission, isPending: isUpdating } = useUpdateMission();
  const { mutate: applyToMission, isPending: isApplying } = useApplyToMission();
  const { mutate: deleteMission, isPending: isDeleting } = useDeleteMission();
  const updateApplicationStatusMutation = useMutation({
    mutationFn: (data: { missionId: string; applicationId: string; status: "PENDING" | "ACCEPTED" | "REJECTED" }) =>
      missionsApi.updateApplicationStatus(data.missionId, data.applicationId, data.status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missionApplications", selectedMissionForApplications?.id] });
      queryClient.invalidateQueries({ queryKey: ["missions"] });
    },
  });
  const { user } = useAuthStore();

  const isFreelancer = user?.role === "FREELANCER";
  const isAdminOrClient = ["ADMIN", "CLIENT"].includes(user?.role || "");
  const userCompanyId = user?.companyId;

  const filteredMissions = missions.filter((mission) =>
    mission.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "OPEN":
        return "bg-green-100 text-green-800";
      case "ASSIGNED":
        return "bg-purple-100 text-purple-800";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800";
      case "COMPLETED":
        return "bg-gray-100 text-gray-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "OPEN":
        return t("missionsPage.statuses.open");
      case "ASSIGNED":
        return "Assigned";
      case "IN_PROGRESS":
        return t("missionsPage.statuses.inProgress");
      case "COMPLETED":
        return t("missionsPage.statuses.completed");
      case "CANCELLED":
        return t("missionsPage.statuses.cancelled");
      default:
        return status;
    }
  };

  const createForm = useForm<CreateMissionForm>({
    resolver: zodResolver(createMissionSchema) as any,
    defaultValues: {
      title: "",
      description: "",
      budget: undefined,
    },
  });

  const editForm = useForm<UpdateMissionForm>({
    resolver: zodResolver(updateMissionSchema) as any,
  });

  const handleCreate = async (data: CreateMissionForm) => {
    createMission(data, {
      onSuccess: () => {
        setCreateDialogOpen(false);
        createForm.reset();
      },
    });
  };

  const handleEdit = (mission: FreelancerMission) => {
    setEditingMission(mission);
    editForm.reset(mission);
    setEditDialogOpen(true);
  };

  const handleUpdate = async (data: UpdateMissionForm) => {
    if (!editingMission) return;
    updateMission(
      { id: editingMission.id, data },
      {
        onSuccess: () => {
          setEditDialogOpen(false);
          setEditingMission(null);
        },
      }
    );
  };

  const handleDelete = (mission: FreelancerMission) => {
    if (confirm(t("missionsPage.areYouSureDelete", { title: mission.title }))) {
      deleteMission(mission.id);
    }
  };

  const handleApply = (missionId: string) => {
    applyToMission(missionId);
  };

  const handleViewApplications = (mission: FreelancerMission) => {
    setSelectedMissionForApplications(mission);
    setApplicationsSheetOpen(true);
  };

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
          <h1 className="font-display text-2xl font-bold text-ink">
            {t("missionsPage.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("missionsPage.subtitle")}
          </p>
        </div>
        {isAdminOrClient && (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t("missionsPage.newMission")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("missionsPage.createMission")}</DialogTitle>
                <DialogDescription>
                  {t("missionsPage.createMissionDesc")}
                </DialogDescription>
              </DialogHeader>
              <Form {...createForm}>
                <form
                  onSubmit={createForm.handleSubmit(handleCreate)}
                  className="space-y-4"
                >
                  <FormField
                    control={createForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("common.title")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("missionsPage.titlePlaceholder")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("common.description")}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t("missionsPage.descriptionPlaceholder")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="budget"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("missionsPage.budgetLabel")}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder={t("missionsPage.budgetPlaceholder")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={isCreating}>
                      {isCreating && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      {t("common.create")}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search & Sort */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("missionsPage.searchMissions")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={`${orderBy ?? "createdAt"}-${orderDir}`}
          onValueChange={(v) => {
            const [col, dir] = v.split("-") as [string, "asc" | "desc"];
            updateParams({ orderBy: col, orderDir: dir, page: 1 });
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Trier par" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="title-asc">Titre (A-Z)</SelectItem>
            <SelectItem value="title-desc">Titre (Z-A)</SelectItem>
            <SelectItem value="status-asc">Statut</SelectItem>
            <SelectItem value="createdAt-desc">Plus récentes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Missions List */}
      <div className="space-y-4">
        {filteredMissions.map((mission) => {
          const isOwner = mission.companyId === userCompanyId;
          const canApply = isFreelancer && mission.status === "OPEN";

          return (
            <Card
              key={mission.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{mission.title}</CardTitle>
                  </div>
                  {isOwner && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {mission.status === "OPEN" && (
                          <DropdownMenuItem onClick={() => handleViewApplications(mission)}>
                            <Users className="h-4 w-4 mr-2" />
                            Voir candidatures ({mission._count?.applications || 0})
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleEdit(mission)}>
                          <Edit className="h-4 w-4 mr-2" />
                          {t("common.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(mission)}
                          disabled={isDeleting}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t("common.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {mission.description || t("missionsPage.noDescription")}
                </p>
                {mission.budget && (
                  <div className="text-sm font-medium">
                    {t("missionsPage.budgetLabel")}: {mission.budget} TND
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeClass(
                      mission.status
                    )}`}
                  >
                    {getStatusLabel(mission.status)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("missionsPage.publishedOn")}{" "}
                    {new Date(mission.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {isAdminOrClient && mission.status === "OPEN" && mission._count?.applications !== undefined && (
                  <Button
                    variant="secondary"
                    onClick={() => handleViewApplications(mission)}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Voir candidatures ({mission._count.applications})
                  </Button>
                )}
                {canApply && (
                  <Button
                    className="w-full mt-2"
                    onClick={() => handleApply(mission.id)}
                    disabled={isApplying}
                  >
                    {isApplying && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {t("missionsPage.apply")}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <DataTablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />

      {/* Applications Sheet */}
      {selectedMissionForApplications && (
        <Sheet open={applicationsSheetOpen} onOpenChange={setApplicationsSheetOpen}>
          <SheetContent className="w-full sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>Candidatures - {selectedMissionForApplications.title}</SheetTitle>
              <SheetDescription>
                Tous les freelancers qui ont postulé à cette mission.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              {applications && applications.length > 0 ? (
                applications.map((application) => (
                  <Card key={application.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 text-sm">
                            <span>
                              {application.freelancer.user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                            </span>
                          </Avatar>
                          <div>
                            <h4 className="font-medium">{application.freelancer.user.name}</h4>
                            <p className="text-sm text-muted-foreground">{application.freelancer.user.email}</p>
                            {application.freelancer.hourlyRate && (
                              <p className="text-sm mt-1">Taux horaire: {application.freelancer.hourlyRate} TND</p>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant={application.status === "PENDING" ? "secondary" : application.status === "ACCEPTED" ? "default" : "destructive"}
                        >
                          {application.status === "PENDING" ? "En attente" : application.status === "ACCEPTED" ? "Accepté" : "Refusé"}
                        </Badge>
                      </div>
                      {application.status === "PENDING" && (
                        <div className="flex gap-2 mt-4">
                          <Button
                            size="sm"
                            onClick={() => updateApplicationStatusMutation.mutate({
                              missionId: selectedMissionForApplications.id,
                              applicationId: application.id,
                              status: "ACCEPTED",
                            })}
                            disabled={updateApplicationStatusMutation.isPending}
                          >
                            Accepter
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => updateApplicationStatusMutation.mutate({
                              missionId: selectedMissionForApplications.id,
                              applicationId: application.id,
                              status: "REJECTED",
                            })}
                            disabled={updateApplicationStatusMutation.isPending}
                          >
                            Refuser
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-center text-muted-foreground">
                  Aucune candidature pour l'instant.
                </p>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Edit Dialog */}
      {editingMission && (
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("missionsPage.editMission")}</DialogTitle>
              <DialogDescription>
                {t("missionsPage.editMissionDesc")}
              </DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form
                onSubmit={editForm.handleSubmit(handleUpdate)}
                className="space-y-4"
              >
                <FormField
                  control={editForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("common.title")}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("common.description")}</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("missionsPage.budgetLabel")}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("common.status")}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("missionsPage.selectStatus")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="OPEN">{t("missionsPage.statuses.open")}</SelectItem>
                          <SelectItem value="ASSIGNED">Assigned</SelectItem>
                          <SelectItem value="IN_PROGRESS">{t("missionsPage.statuses.inProgress")}</SelectItem>
                          <SelectItem value="COMPLETED">{t("missionsPage.statuses.completed")}</SelectItem>
                          <SelectItem value="CANCELLED">{t("missionsPage.statuses.cancelled")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {t("common.save")}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
