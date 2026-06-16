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
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useMissions,
  useCreateMission,
  useUpdateMission,
  useApplyToMission,
  useDeleteMission,
} from "@/hooks/useMissions";
import type { FreelancerMission } from "@/types/freelancer";
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
import { useAuthStore } from "@/store/auth.store";
import { useTranslation } from "react-i18next";

const createMissionSchema = z.object({
  title: z.string().min(1, "Title required"),
  description: z.string().optional(),
  budget: z.coerce.number().positive().optional(),
});

const updateMissionSchema = createMissionSchema.extend({
  status: z
    .enum(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
    .optional(),
});

type CreateMissionForm = z.infer<typeof createMissionSchema>;
type UpdateMissionForm = z.infer<typeof updateMissionSchema>;

export function MissionsPage() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMission, setEditingMission] =
    useState<FreelancerMission | null>(null);

  const { data: missions, isLoading } = useMissions();
  const { mutate: createMission, isPending: isCreating } = useCreateMission();
  const { mutate: updateMission, isPending: isUpdating } = useUpdateMission();
  const { mutate: applyToMission, isPending: isApplying } =
    useApplyToMission();
  const { mutate: deleteMission, isPending: isDeleting } = useDeleteMission();
  const { user } = useAuthStore();

  const isFreelancer = user?.role === "FREELANCER";
  const isAdminOrClient = ["ADMIN", "CLIENT"].includes(user?.role || "");
  const userCompanyId = user?.companyId;

  const filteredMissions =
    missions?.filter((mission) =>
      mission.title.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "OPEN":
        return "bg-green-100 text-green-800";
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

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder={t("missionsPage.searchMissions")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
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
