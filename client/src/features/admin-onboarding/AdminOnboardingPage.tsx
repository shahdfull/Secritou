import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  useClientOnboardings,
  useCreateClientOnboarding,
} from "@/hooks/useClientOnboarding";
import { useProjects } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/common/DataTablePagination";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Eye, Edit } from "lucide-react";
import { useListParams } from "@/hooks/useListParams";

export function AdminOnboardingPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useListParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const { data: onboardings, isLoading } = useClientOnboardings(searchParams);
  const { data: projects } = useProjects();
  const createOnboarding = useCreateClientOnboarding();

  const handleCreateOnboarding = () => {
    if (!selectedProjectId) return;
    createOnboarding.mutate(
      { projectId: selectedProjectId },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setSelectedProjectId(null);
        },
      }
    );
  };

  const calculateProgress = (onboarding: any) => {
    const completed = onboarding.steps.filter(
      (s: any) => s.status === "COMPLETED"
    ).length;
    return Math.round((completed / onboarding.steps.length) * 100);
  };

  return (
    <section className="container-page py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("onboarding.admin.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("onboarding.admin.subtitle")}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t("onboarding.admin.createOnboarding")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("onboarding.admin.createOnboarding")}</DialogTitle>
              <DialogDescription>
                {t("onboarding.admin.subtitle")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Select
                value={selectedProjectId || ""}
                onValueChange={setSelectedProjectId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects?.data.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreateOnboarding}
                disabled={!selectedProjectId || createOnboarding.isPending}
              >
                {createOnboarding.isPending ? "Creating..." : t("onboarding.admin.createOnboarding")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Input
        placeholder={t("onboarding.admin.searchOnboardings")}
        value={searchParams.search || ""}
        onChange={(e) => setSearchParams({ search: e.target.value })}
        className="mb-6 max-w-md"
      />

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("onboarding.admin.client")}</TableHead>
              <TableHead>{t("onboarding.admin.project")}</TableHead>
              <TableHead>{t("onboarding.admin.status")}</TableHead>
              <TableHead>{t("onboarding.admin.progress")}</TableHead>
              <TableHead>{t("onboarding.admin.createdAt")}</TableHead>
              <TableHead className="text-right">{t("onboarding.admin.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">
                  Loading...
                </TableCell>
              </TableRow>
            ) : onboardings?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">
                  {t("onboarding.admin.empty")}
                </TableCell>
              </TableRow>
            ) : (
              onboardings?.data.map((onboarding) => (
                <TableRow key={onboarding.id}>
                  <TableCell className="font-medium">
                    {onboarding.client.name}
                  </TableCell>
                  <TableCell>{onboarding.project.name}</TableCell>
                  <TableCell>
                    {onboarding.steps.some((s: any) => s.status === "COMPLETED")
                      ? "In progress"
                      : "Pending"}
                  </TableCell>
                  <TableCell>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-primary h-2.5 rounded-full"
                        style={{ width: `${calculateProgress(onboarding)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground mt-1">
                      {calculateProgress(onboarding)}%
                    </span>
                  </TableCell>
                  <TableCell>
                    {new Date(onboarding.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="icon">
                      <Link
                        to={`/app/client-onboarding/${onboarding.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {onboardings && (
        <DataTablePagination
          page={onboardings.page}
          pageSize={onboardings.pageSize}
          totalCount={onboardings.total}
          onPageChange={(page) => setSearchParams({ page })}
          onPageSizeChange={(pageSize) =>
            setSearchParams({ pageSize, page: 1 })
          }
        />
      )}
    </section>
  );
}
