import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/api/axios";
import { projectsApi } from "@/api/projects.api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ProjectTimeline } from "./components/ProjectTimeline";

interface ClientProject {
  id: string;
  name: string;
  status: string;
  progress?: number;
  clientApprovedAt?: string | null;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "PLANNING":
      return "bg-blue-100 text-blue-800";
    case "IN_PROGRESS":
      return "bg-yellow-100 text-yellow-800";
    case "REVIEW":
      return "bg-purple-100 text-purple-800";
    case "COMPLETED":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case "PLANNING":
      return "Planification";
    case "IN_PROGRESS":
      return "En cours";
    case "REVIEW":
      return "En revue";
    case "COMPLETED":
      return "Terminé";
    default:
      return status;
  }
};

function useMyProjects() {
  return useQuery({
    queryKey: ["client-projects"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: ClientProject[]; total: number }>("/projects/my", {
        params: { page: 1, pageSize: 100 },
      });
      return res.data;
    },
    staleTime: 60_000,
  });
}

interface ApproveDialogProps {
  project: ClientProject;
  open: boolean;
  onClose: () => void;
}

function ApproveDialog({ project, open, onClose }: ApproveDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: () => projectsApi.clientApprove(project.id),
    onSuccess: () => {
      toast.success(`Le projet « ${project.name} » est clôturé. Votre facture de solde est disponible.`);
      void queryClient.invalidateQueries({ queryKey: ["client-projects"] });
      void queryClient.invalidateQueries({ queryKey: ["project-timeline", project.id] });
      void queryClient.invalidateQueries({ queryKey: ["client-invoices"] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Une erreur est survenue.";
      toast.error(msg);
    },
  });

  const handleClose = () => {
    if (!approveMutation.isPending) {
      setConfirmed(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Approuver et clôturer le projet</DialogTitle>
          <DialogDescription>
            Vous êtes sur le point de valider la livraison du projet{" "}
            <strong>« {project.name} »</strong>. Cette action est irréversible.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Une fois approuvé, le projet sera clôturé et votre{" "}
            <strong>facture de solde</strong> sera générée et disponible dans votre portail.
          </div>

          <div className="flex items-start gap-3 pt-1">
            <Checkbox
              id="confirm-approve"
              checked={confirmed}
              onCheckedChange={(v) => setConfirmed(!!v)}
            />
            <label htmlFor="confirm-approve" className="text-sm leading-snug cursor-pointer">
              Je confirme avoir reçu et validé tous les livrables du projet{" "}
              <strong>« {project.name} »</strong>.
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={approveMutation.isPending}>
            Annuler
          </Button>
          <Button
            disabled={!confirmed || approveMutation.isPending}
            onClick={() => approveMutation.mutate()}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {approveMutation.isPending ? "Clôture en cours…" : "Confirmer et clôturer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectsClientPage() {
  const { t } = useTranslation();
  const [approveTarget, setApproveTarget] = useState<ClientProject | null>(null);
  const { data: projectsResult, isLoading } = useMyProjects();
  const projects = (projectsResult?.data ?? []) as ClientProject[];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="container-page max-w-6xl mx-auto py-8">
      <h1 className="text-3xl font-bold text-ink mb-8">Mes Projets</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => {
          const progress = project.progress ?? 0;
          const canApprove = project.status === "REVIEW" && !project.clientApprovedAt;
          const isApproved = !!project.clientApprovedAt || project.status === "COMPLETED";

          return (
            <Card key={project.id} className="rounded-3xl border border-border shadow-soft">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-xl font-bold text-ink">{project.name}</CardTitle>
                  <Badge className={getStatusColor(project.status)}>
                    {getStatusText(project.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <div className="flex justify-between text-sm text-muted-foreground mb-1">
                    <span>Progression</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <ProjectTimeline projectId={project.id} />

                {isApproved && (
                  <div className="mt-4 rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700 font-medium text-center">
                    Projet approuvé — livraison validée ✓
                  </div>
                )}

                {canApprove && (
                  <Button
                    className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => setApproveTarget(project)}
                  >
                    Approuver et clôturer le projet
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {approveTarget && (
        <ApproveDialog
          project={approveTarget}
          open={true}
          onClose={() => setApproveTarget(null)}
        />
      )}
    </div>
  );
}
