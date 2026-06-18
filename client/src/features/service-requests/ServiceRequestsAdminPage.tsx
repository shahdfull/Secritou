import { useState, useRef } from "react";
import {
  useAdminServiceRequests,
  useAdminServiceRequest,
  useAdminUpdateServiceRequest,
  useAdminDeleteServiceRequest,
  useAddComment,
  useDeleteComment,
} from "@/hooks/useServiceRequests";
import type {
  ServiceRequest,
  ServiceRequestStatus,
  ServiceRequestPriority,
  AdminListServiceRequestsParams,
} from "@/types/serviceRequest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Search,
  MoreHorizontal,
  Trash2,
  RefreshCw,
  MessageSquare,
  Clock,
  Lock,
  Globe,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useDebouncedValue } from "@/hooks/shared/useDebouncedValue";
import { useAuthStore } from "@/store/auth.store";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: ServiceRequestStatus; label: string }[] = [
  { value: "NEW", label: "Nouveau" },
  { value: "IN_REVIEW", label: "En révision" },
  { value: "IN_PROGRESS", label: "En cours" },
  { value: "WAITING_CLIENT", label: "Attente client" },
  { value: "COMPLETED", label: "Terminé" },
  { value: "CANCELLED", label: "Annulé" },
];

const PRIORITY_OPTIONS: { value: ServiceRequestPriority; label: string }[] = [
  { value: "LOW", label: "Faible" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "Élevée" },
  { value: "URGENT", label: "Urgent" },
];

// Allowed transitions per status
const NEXT_STATUSES: Record<ServiceRequestStatus, ServiceRequestStatus[]> = {
  NEW: ["IN_REVIEW", "CANCELLED"],
  IN_REVIEW: ["IN_PROGRESS", "WAITING_CLIENT", "CANCELLED"],
  IN_PROGRESS: ["WAITING_CLIENT", "COMPLETED", "CANCELLED"],
  WAITING_CLIENT: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  DONE: ["COMPLETED"],
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
    case "DONE":
      return "bg-green-100 text-green-800 border-green-200";
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

function statusLabel(status: ServiceRequestStatus): string {
  return STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

function priorityLabel(priority: string): string {
  return PRIORITY_OPTIONS.find((o) => o.value === priority)?.label ?? priority;
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

// ─── Detail panel ─────────────────────────────────────────────────────────────

function ServiceRequestDetail({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const { data: request, isLoading } = useAdminServiceRequest(id);
  const updateMutation = useAdminUpdateServiceRequest(id);
  const addComment = useAddComment(id);
  const deleteComment = useDeleteComment(id);
  const user = useAuthStore((s) => s.user);

  const [commentBody, setCommentBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
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

  const handleStatusChange = (status: ServiceRequestStatus) => {
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

        {/* Status + Priority row */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={statusBadgeClass(request.status)}>
            {statusLabel(request.status)}
          </Badge>
          <Badge variant="outline" className={priorityBadgeClass(request.priority)}>
            {priorityLabel(request.priority)}
          </Badge>
        </div>

        {/* Description */}
        {request.description && (
          <p className="text-sm text-muted-foreground mt-2">{request.description}</p>
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0 px-6 py-4 border-b space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Actions
        </p>

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
                  {statusLabel(s)}
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
              {PRIORITY_OPTIONS.map((o) => (
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
            {request.history.map((h) => (
              <div key={h.id} className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span className="w-20 shrink-0 text-right">{formatDate(h.createdAt)}</span>
                <span className="font-medium text-foreground">{h.user?.name ?? "Système"}</span>
                <span>a changé</span>
                <span className="font-mono bg-muted rounded px-1">{h.field}</span>
                <span>de</span>
                <span className="font-mono bg-muted rounded px-1">
                  {h.oldValue ?? "—"}
                </span>
                <span>→</span>
                <span className="font-mono bg-muted rounded px-1">
                  {h.newValue ?? "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ServiceRequestsAdminPage() {
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
  const totalPages = Math.ceil(total / (filters.pageSize ?? 20));
  const currentPage = filters.page ?? 1;

  const setFilter = <K extends keyof AdminListServiceRequestsParams>(
    key: K,
    value: AdminListServiceRequestsParams[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="px-6 py-5 border-b shrink-0">
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
              {STATUS_OPTIONS.map((o) => (
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
              {PRIORITY_OPTIONS.map((o) => (
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
      <div className="flex flex-1 overflow-hidden">
        {/* Table */}
        <div
          className={`flex-1 overflow-auto transition-opacity ${
            isPlaceholderData ? "opacity-60" : ""
          }`}
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <RefreshCw className="h-10 w-10 mb-3 opacity-30" />
              <p>Aucune demande trouvée</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-1/3">
                    Demande
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Priorité</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Assigné</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Créée le</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {requests.map((req: ServiceRequest) => (
                  <tr
                    key={req.id}
                    className={`border-b hover:bg-muted/40 cursor-pointer transition-colors ${
                      selectedId === req.id ? "bg-muted/60" : ""
                    }`}
                    onClick={() => setSelectedId(req.id)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium line-clamp-1">{req.title}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {req.client?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`text-xs ${statusBadgeClass(req.status)}`}
                      >
                        {statusLabel(req.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`text-xs ${priorityBadgeClass(req.priority)}`}
                      >
                        {priorityLabel(req.priority)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {req.assignedTo?.name ?? <span className="italic">Non assigné</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(req.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(req.id);
                            }}
                          >
                            Voir le détail
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(req.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} sur {totalPages} — {total} résultat{total !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setFilters((p) => ({ ...p, page: (p.page ?? 1) - 1 }))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setFilters((p) => ({ ...p, page: (p.page ?? 1) + 1 }))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Detail side panel (Sheet used as inline slide-in) */}
        <Sheet open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
          <SheetContent side="right" className="w-[480px] sm:w-[520px] p-0 flex flex-col">
            <SheetHeader className="sr-only">
              <SheetTitle>Détail de la demande</SheetTitle>
              <SheetDescription>Gérer la demande de service</SheetDescription>
            </SheetHeader>
            {selectedId && (
              <ServiceRequestDetail
                id={selectedId}
                onClose={() => setSelectedId(null)}
              />
            )}
          </SheetContent>
        </Sheet>
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
