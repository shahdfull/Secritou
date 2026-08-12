// Mobile-responsive: updated 2026-06-29
import { useCallback, useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  useAdminServiceRequests,
  useAdminServiceRequest,
  useAdminUpdateServiceRequest,
  useAdminDeleteServiceRequest,
  useAddComment,
  useDeleteComment,
} from "@/hooks/useServiceRequests";
import { useCreateProposal } from "@/hooks/useProposals";
import type {
  ServiceRequest,
  ServiceRequestStatus,
  ServiceRequestPriority,
  ServiceRequestType,
  AdminListServiceRequestsParams,
} from "@/types/serviceRequest";
import { AgGridReact } from "ag-grid-react";
import "@/lib/agGridModules";
import {
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
  type SortChangedEvent,
} from "ag-grid-community";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConfirmationDialog } from "@/components/shared/crud/ConfirmationDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Search,
  Trash2,
  Eye,
  MessageSquare,
  Clock,
  Lock,
  Globe,
  ChevronRight,
  Loader2,
  File,
  AlertTriangle,
} from "lucide-react";
import { useDebouncedValue } from "@/hooks/shared/useDebouncedValue";
import { useAuthStore } from "@/store/auth.store";
import { DataTablePagination } from "@/components/common/DataTablePagination";


// Cohérent avec la migration AG Grid de TasksListView.tsx (mêmes tokens, thème clair unique).
const gridTheme = themeQuartz.withParams({
  accentColor: "#0f766e",
  headerBackgroundColor: "#f8fafc",
  headerTextColor: "#334155",
  rowHoverColor: "#f1f5f9",
  borderColor: "#e2e8f0",
  fontFamily: "inherit",
});

// Mêmes noms de colonnes que côté serveur (serviceRequest.repository.ts#SORTABLE_FIELDS).
const AG_FIELD_TO_SORT_COLUMN: Record<string, string> = {
  title: "title",
  status: "status",
  priority: "priority",
  createdAt: "createdAt",
};

// ─── Constants ────────────────────────────────────────────────────────────────

function getStatusOptions(t: TFunction): { value: ServiceRequestStatus; label: string }[] {
  return [
    { value: "NEW", label: t("serviceRequestsAdmin.statuses.NEW") },
    { value: "IN_REVIEW", label: t("serviceRequestsAdmin.statuses.IN_REVIEW") },
    { value: "IN_PROGRESS", label: t("serviceRequestsAdmin.statuses.IN_PROGRESS") },
    { value: "WAITING_CLIENT", label: t("serviceRequestsAdmin.statuses.WAITING_CLIENT") },
    { value: "COMPLETED", label: t("serviceRequestsAdmin.statuses.COMPLETED") },
    { value: "CANCELLED", label: t("serviceRequestsAdmin.statuses.CANCELLED") },
  ];
}

function getPriorityOptions(t: TFunction): { value: ServiceRequestPriority; label: string }[] {
  return [
    { value: "LOW", label: t("serviceRequestsAdmin.priorities.LOW") },
    { value: "NORMAL", label: t("serviceRequestsAdmin.priorities.NORMAL") },
    { value: "HIGH", label: t("serviceRequestsAdmin.priorities.HIGH") },
    { value: "URGENT", label: t("serviceRequestsAdmin.priorities.URGENT") },
  ];
}

function getTypeOptions(t: TFunction): { value: ServiceRequestType; label: string }[] {
  return [
    { value: "SUPPORT", label: t("serviceRequestsAdmin.types.SUPPORT") },
    { value: "NEW_PROJECT", label: t("serviceRequestsAdmin.types.NEW_PROJECT") },
  ];
}

function typeLabel(type: string, t: TFunction): string {
  return t(`serviceRequestsAdmin.types.${type}`, type);
}

// Allowed transitions per status
const NEXT_STATUSES: Record<ServiceRequestStatus, ServiceRequestStatus[]> = {
  NEW: ["IN_REVIEW", "CANCELLED"],
  IN_REVIEW: ["IN_PROGRESS", "WAITING_CLIENT", "CANCELLED"],
  IN_PROGRESS: ["WAITING_CLIENT", "COMPLETED", "CANCELLED"],
  WAITING_CLIENT: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

// Status auto-advanced when a proposal is created
const PROPOSAL_STATUS_ADVANCE: Partial<Record<ServiceRequestStatus, ServiceRequestStatus>> = {
  NEW: "IN_REVIEW",
  WAITING_CLIENT: "IN_PROGRESS",
};

// ─── Utility helpers ──────────────────────────────────────────────────────────

function statusBadgeClass(status: ServiceRequestStatus): string {
  switch (status) {
    case "NEW":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "IN_REVIEW":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "IN_PROGRESS":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "WAITING_CLIENT":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "COMPLETED":
      return "bg-green-100 text-green-800 border-green-200";
    case "CANCELLED":
      return "bg-gray-100 text-gray-600 border-gray-200";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case "URGENT":
      return "bg-red-100 text-red-800 border-red-200";
    case "HIGH":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "NORMAL":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "LOW":
      return "bg-gray-50 text-gray-500 border-gray-200";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function statusLabel(status: ServiceRequestStatus, t: TFunction): string {
  return t(`serviceRequestsAdmin.statuses.${status}`, status);
}

function priorityLabel(priority: string, t: TFunction): string {
  return t(`serviceRequestsAdmin.priorities.${priority}`, priority);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildSmartTitle(clientName: string | undefined, requestTitle: string): string {
  const parts = ["Proposition"];
  if (clientName) parts.push(clientName);
  parts.push(requestTitle);
  return parts.join(" — ");
}

// Resolve assignedToId history values to human names using a lookup map
function resolveHistoryValue(field: string, value: string | null | undefined, assigneeMap: Record<string, string>): string {
  if (value == null || value === "") return "—";
  if (field === "assignedToId") return assigneeMap[value] ?? value.slice(0, 8) + "…";
  return value;
}

// ─── Create Proposal Modal ────────────────────────────────────────────────────

function CreateProposalModal({
  open,
  defaultTitle,
  onCancel,
  onConfirm,
  isPending,
}: {
  open: boolean;
  defaultTitle: string;
  onCancel: () => void;
  onConfirm: (title: string) => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState(defaultTitle);

  useEffect(() => {
    if (open) setTitle(defaultTitle);
  }, [open, defaultTitle]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Créer une proposition</DialogTitle>
          <DialogDescription>
            Vérifiez le titre avant de créer la proposition. Vous pourrez modifier tous les détails
            après création.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="proposal-title" className="text-sm font-medium">
            Titre de la proposition
          </Label>
          <Input
            id="proposal-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de la proposition…"
            className="text-sm"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            Annuler
          </Button>
          <Button
            onClick={() => onConfirm(title.trim())}
            disabled={isPending || !title.trim()}
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Créer la proposition
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function ServiceRequestDetail({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: request, isLoading } = useAdminServiceRequest(id);
  const updateMutation = useAdminUpdateServiceRequest(id);
  const addComment = useAddComment(id);
  const deleteComment = useDeleteComment(id);
  const createProposal = useCreateProposal();
  const user = useAuthStore((s) => s.user);
  const [statusTarget, setStatusTarget] = useState<ServiceRequestStatus | null>(null);

  const [commentBody, setCommentBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!request) return null;

  const nextStatuses = NEXT_STATUSES[request.status] ?? [];
  const alreadyHasProposal = !!request.proposal;
  const canCreateProposal = !alreadyHasProposal && request.type !== "SUPPORT";

  const smartTitle = buildSmartTitle(request.client?.name, request.title);

  // Build a map of known userId → name from the history + assignedTo fields so we can
  // render assignedToId changes as names instead of raw UUIDs.
  const assigneeMap: Record<string, string> = {};
  if (request.assignedTo) {
    assigneeMap[request.assignedTo.id] = request.assignedTo.name;
  }
  for (const h of request.history) {
    if (h.user) assigneeMap[h.user.id] = h.user.name;
  }

  const handleConfirmCreateProposal = async (title: string) => {
    if (!request) return;
    try {
      const proposal = await createProposal.mutateAsync({
        title,
        description: request.description,
        clientId: request.clientId,
        serviceRequestId: request.id,
      });

      // Auto-advance status if applicable
      const nextStatus = PROPOSAL_STATUS_ADVANCE[request.status];
      if (nextStatus) {
        await updateMutation.mutateAsync({ status: nextStatus });
      }

      setShowProposalModal(false);
      onClose();
      navigate(`/app/commercial?tab=proposals&id=${proposal.id}`);
    } catch {
      // errors handled by the mutation's onError toast
      setShowProposalModal(false);
    }
  };

  const handleStatusChange = (status: ServiceRequestStatus) => {
    if (status === "CANCELLED") {
      setStatusTarget(status);
      return;
    }
    updateMutation.mutate({ status });
  };

  const handlePriorityChange = (priority: ServiceRequestPriority) => {
    updateMutation.mutate({ priority });
  };

  const handleAddComment = () => {
    if (!commentBody.trim()) return;
    addComment.mutate(
      { body: commentBody.trim(), isInternal },
      {
        onSuccess: () => {
          setCommentBody("");
          setIsInternal(false);
        },
      }
    );
  };

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="shrink-0 p-6 border-b space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg font-semibold leading-tight">{request.title}</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Client info */}
          <p className="text-sm text-muted-foreground">
            Client : <span className="font-medium text-foreground">{request.client?.name}</span>
          </p>

          {/* Status + Priority + Type row */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={statusBadgeClass(request.status)}>
              {statusLabel(request.status, t)}
            </Badge>
            <Badge variant="outline" className={priorityBadgeClass(request.priority)}>
              {priorityLabel(request.priority, t)}
            </Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="bg-slate-50 text-slate-600 border-slate-200 gap-1 cursor-default"
                  >
                    <Lock className="h-3 w-3" />
                    {typeLabel(request.type, t)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-48 text-center">
                  Le type ne peut pas être modifié après création. Créez une nouvelle demande pour
                  changer le type.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Description */}
          {request.description && (
            <p className="text-sm text-muted-foreground mt-2">{request.description}</p>
          )}

          {/* Linked proposal indicator */}
          {alreadyHasProposal && (
            <p className="text-xs text-muted-foreground">
              Proposition liée :{" "}
              <button
                className="text-primary underline underline-offset-2 hover:opacity-75"
                onClick={() => {
                  onClose();
                  navigate(`/app/commercial?tab=proposals&id=${request.proposal!.id}`);
                }}
              >
                {request.proposal!.title}
              </button>
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="shrink-0 px-6 py-4 border-b space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Actions
          </p>

          {canCreateProposal ? (
            <Button onClick={() => setShowProposalModal(true)} disabled={createProposal.isPending}>
              {createProposal.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <File className="h-4 w-4 mr-2" />
              Créer une proposition
            </Button>
          ) : request.type === "SUPPORT" ? (
            <p className="text-xs text-muted-foreground italic">
              Les demandes de support ne génèrent pas de proposition.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Une proposition est déjà liée à cette demande.
            </p>
          )}

          {/* Status transitions */}
          {nextStatuses.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Changer le statut</p>
              <div className="flex flex-wrap gap-1.5">
                {nextStatuses.map((s) => (
                  <Button
                    key={s}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={updateMutation.isPending}
                    onClick={() => handleStatusChange(s)}
                  >
                    {statusLabel(s, t)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Priority */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Priorité</p>
            <Select
              value={request.priority}
              onValueChange={(v) => handlePriorityChange(v as ServiceRequestPriority)}
              disabled={updateMutation.isPending}
            >
              <SelectTrigger className="h-8 text-xs w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getPriorityOptions(t).map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Comments */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            Commentaires ({request.comments.length})
          </p>

          {request.comments.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun commentaire pour l'instant.
            </p>
          )}

          <div className="space-y-3">
            {request.comments.map((c) => (
              <div
                key={c.id}
                className={`rounded-lg p-3 text-sm border ${
                  c.isInternal
                    ? "bg-amber-50 border-amber-200"
                    : "bg-muted border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{c.author.name}</span>
                    {c.isInternal && (
                      <span className="flex items-center gap-0.5 text-xs text-amber-700">
                        <Lock className="h-3 w-3" /> Interne
                      </span>
                    )}
                    {!c.isInternal && (
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <Globe className="h-3 w-3" /> Visible client
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">
                      {formatDate(c.createdAt)}
                    </span>
                    {c.author.id === user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => deleteComment.mutate(c.id)}
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}
          </div>

          {/* Add comment */}
          <div className="space-y-2 pt-2 border-t">
            <Textarea
              ref={commentRef}
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Ajouter un commentaire..."
              rows={3}
              className="text-sm resize-none"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="internal-switch"
                  checked={isInternal}
                  onCheckedChange={setIsInternal}
                  className="scale-75"
                />
                <Label htmlFor="internal-switch" className="text-xs text-muted-foreground cursor-pointer">
                  Note interne
                </Label>
              </div>
              <Button
                size="sm"
                disabled={!commentBody.trim() || addComment.isPending}
                onClick={handleAddComment}
              >
                {addComment.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Envoyer
              </Button>
            </div>
          </div>
        </div>

        {/* History */}
        {request.history.length > 0 && (
          <div className="shrink-0 border-t px-6 py-4 space-y-2 max-h-52 overflow-y-auto">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Historique
            </p>
            <div className="space-y-1.5">
              {request.history.map((h) => {
                const fieldLabel = h.field === "assignedToId" ? "assigné à" : h.field;
                const oldDisplay = resolveHistoryValue(h.field, h.oldValue, assigneeMap);
                const newDisplay = resolveHistoryValue(h.field, h.newValue, assigneeMap);
                return (
                  <div key={h.id} className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span className="w-20 shrink-0 text-right">{formatDate(h.createdAt)}</span>
                    <span className="font-medium text-foreground">{h.user?.name ?? "Système"}</span>
                    <span>a changé</span>
                    <span className="font-mono bg-muted rounded px-1">{fieldLabel}</span>
                    <span>de</span>
                    <span className="font-mono bg-muted rounded px-1">{oldDisplay}</span>
                    <span>→</span>
                    <span className="font-mono bg-muted rounded px-1">{newDisplay}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <CreateProposalModal
        open={showProposalModal}
        defaultTitle={smartTitle}
        onCancel={() => setShowProposalModal(false)}
        onConfirm={handleConfirmCreateProposal}
        isPending={createProposal.isPending || updateMutation.isPending}
      />

      <ConfirmationDialog
        open={statusTarget === "CANCELLED"}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        onConfirm={() => {
          updateMutation.mutate({ status: "CANCELLED" }, { onSuccess: () => setStatusTarget(null) });
        }}
        isLoading={updateMutation.isPending}
        variant="destructive"
        title="Confirmer l'annulation de cette demande ?"
        description={
          <>
            Cette transition est terminale et ne pourra pas être annulée ensuite. Vérifiez bien la
            demande avant de confirmer.
            <br />
            <strong>{request.title}</strong>
          </>
        }
        checkboxLabel={<>Je confirme l'annulation irréversible de la demande « {request.title} ».</>}
        confirmLabel="Confirmer"
        cancelLabel="Annuler"
      />
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ServiceRequestsAdminPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<AdminListServiceRequestsParams>({
    page: 1,
    pageSize: 20,
    orderDir: "desc",
  });
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const queryParams: AdminListServiceRequestsParams = {
    ...filters,
    search: debouncedSearch || undefined,
  };

  const { data, isLoading, isPlaceholderData } = useAdminServiceRequests(queryParams);
  const deleteMutation = useAdminDeleteServiceRequest();

  const requests = data?.data ?? [];
  const total = data?.total ?? 0;
  const currentPage = filters.page ?? 1;

  const setFilter = <K extends keyof AdminListServiceRequestsParams>(
    key: K,
    value: AdminListServiceRequestsParams[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const sortForField = useCallback(
    (field: string): "asc" | "desc" | null => {
      const activeColumn = filters.orderBy ?? "createdAt";
      return AG_FIELD_TO_SORT_COLUMN[field] === activeColumn ? (filters.orderDir ?? "desc") : null;
    },
    [filters.orderBy, filters.orderDir]
  );

  const handleSortChanged = useCallback(
    (event: SortChangedEvent<ServiceRequest>) => {
      const sortedCol = event.api.getColumnState().find((c) => c.sort);
      if (!sortedCol) return;
      const column = AG_FIELD_TO_SORT_COLUMN[sortedCol.colId];
      if (column) {
        setFilters((prev) => ({ ...prev, orderBy: column, orderDir: sortedCol.sort === "desc" ? "desc" : "asc", page: 1 }));
      }
    },
    []
  );

  const titleRenderer = useCallback((params: ICellRendererParams<ServiceRequest>) => {
    const req = params.data;
    if (!req) return null;
    const isUnassignedNew = req.status === "NEW" && !req.assignedToId;
    return (
      <div className="flex h-full items-center gap-2 min-w-0">
        {isUnassignedNew && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                Demande non assignée
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <span className="font-medium truncate">{req.title}</span>
      </div>
    );
  }, []);

  const statusRenderer = useCallback((params: ICellRendererParams<ServiceRequest>) => {
    const req = params.data;
    if (!req) return null;
    return (
      <div className="flex h-full items-center">
        <Badge variant="outline" className={`text-xs ${statusBadgeClass(req.status)}`}>
          {statusLabel(req.status, t)}
        </Badge>
      </div>
    );
  }, [t]);

  const priorityRenderer = useCallback((params: ICellRendererParams<ServiceRequest>) => {
    const req = params.data;
    if (!req) return null;
    return (
      <div className="flex h-full items-center">
        <Badge variant="outline" className={`text-xs ${priorityBadgeClass(req.priority)}`}>
          {priorityLabel(req.priority, t)}
        </Badge>
      </div>
    );
  }, [t]);

  const requestActionsRenderer = useCallback(
    (params: ICellRendererParams<ServiceRequest>) => {
      const req = params.data;
      if (!req) return null;
      return (
        <div className="flex h-full items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Voir" onClick={(e) => { e.stopPropagation(); setSelectedId(req.id); }}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" title="Supprimer" onClick={(e) => { e.stopPropagation(); setDeleteTarget(req.id); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      );
    },
    []
  );

  const columnDefs = useMemo<ColDef<ServiceRequest>[]>(
    () => [
      { headerName: "Demande", cellRenderer: titleRenderer, flex: 2, sortable: true, sort: sortForField("title"), comparator: () => 0, colId: "title" },
      { headerName: "Client", valueGetter: (p) => p.data?.client?.name ?? "—", flex: 1 },
      { headerName: "Statut", cellRenderer: statusRenderer, flex: 1, sortable: true, sort: sortForField("status"), comparator: () => 0, colId: "status" },
      { headerName: "Priorité", cellRenderer: priorityRenderer, flex: 1, sortable: true, sort: sortForField("priority"), comparator: () => 0, colId: "priority" },
      { headerName: "Assigné", valueGetter: (p) => p.data?.assignedTo?.name ?? "Non assigné", flex: 1, cellClass: "text-muted-foreground text-xs" },
      { headerName: "Créée le", valueFormatter: (p) => new Date(p.data!.createdAt).toLocaleDateString("fr-FR"), field: "createdAt", flex: 1, sortable: true, sort: sortForField("createdAt"), comparator: () => 0 },
      { headerName: "Actions", cellRenderer: requestActionsRenderer, width: 100, sortable: false, resizable: false },
    ],
    [titleRenderer, statusRenderer, priorityRenderer, requestActionsRenderer, sortForField]
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Demandes de Service</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {total} demande{total !== 1 ? "s" : ""} au total
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mt-4">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Rechercher..."
              className="pl-9 h-9"
            />
          </div>

          <Select
            value={filters.status ?? "ALL"}
            onValueChange={(v) =>
              setFilter("status", v === "ALL" ? undefined : (v as ServiceRequestStatus))
            }
          >
            <SelectTrigger className="h-9 w-44">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les statuts</SelectItem>
              {getStatusOptions(t).map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.priority ?? "ALL"}
            onValueChange={(v) =>
              setFilter("priority", v === "ALL" ? undefined : (v as ServiceRequestPriority))
            }
          >
            <SelectTrigger className="h-9 w-40">
              <SelectValue placeholder="Priorité" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toutes priorités</SelectItem>
              {getPriorityOptions(t).map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.type ?? "ALL"}
            onValueChange={(v) =>
              setFilter("type", v === "ALL" ? undefined : (v as ServiceRequestType))
            }
          >
            <SelectTrigger className="h-9 w-44">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les types</SelectItem>
              {getTypeOptions(t).map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.orderDir ?? "desc"}
            onValueChange={(v) => setFilter("orderDir", v as "asc" | "desc")}
          >
            <SelectTrigger className="h-9 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Plus récentes</SelectItem>
              <SelectItem value="asc">Plus anciennes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content area */}
      <div className="flex">
        {/* Table */}
        <div
          className={`flex-1 transition-opacity ${
            isPlaceholderData ? "opacity-60" : ""
          }`}
        >
          <div style={{ height: 500 }}>
            <AgGridReact<ServiceRequest>
              theme={gridTheme}
              rowData={requests}
              columnDefs={columnDefs}
              loading={isLoading}
              onSortChanged={handleSortChanged}
              onRowClicked={(event) => event.data && setSelectedId(event.data.id)}
              rowClass="cursor-pointer"
              getRowClass={(params) =>
                params.data?.status === "NEW" && !params.data.assignedToId ? "bg-amber-50/60" : undefined
              }
              suppressCellFocus
              overlayLoadingTemplate="Chargement..."
              overlayNoRowsTemplate="Aucune demande trouvée"
            />
          </div>

          <DataTablePagination
            page={currentPage}
            pageSize={filters.pageSize ?? 20}
            total={total}
            onPageChange={(newPage) => setFilters((p) => ({ ...p, page: newPage }))}
          />
        </div>

        {/* Detail side panel */}
        <Dialog open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
          <DialogContent className="max-w-5xl w-[95vw] p-0 overflow-hidden">
            <DialogHeader className="sr-only">
              <DialogTitle>Détail de la demande</DialogTitle>
              <DialogDescription>Gérer la demande de service</DialogDescription>
            </DialogHeader>
            {selectedId && (
              <ServiceRequestDetail
                id={selectedId}
                onClose={() => setSelectedId(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la demande ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La demande et tous ses commentaires seront supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteTarget) return;
                deleteMutation.mutate(deleteTarget, {
                  onSuccess: () => {
                    setDeleteTarget(null);
                    if (selectedId === deleteTarget) setSelectedId(null);
                  },
                });
              }}
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}