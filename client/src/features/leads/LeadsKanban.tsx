import { memo, useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay, DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FileText } from "lucide-react";
import { useUpdateLeadStatus } from "@/hooks/useLeads";
import type { Lead } from "@/types/lead";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CreateProposalFromLeadDialog } from "./CreateProposalFromLeadDialog";

// A Proposal can only be created from a lead that has been WON and converted to a client.
const CAN_CREATE_PROPOSAL: Lead["status"][] = ["WON"];

// Allowed pipeline transitions, mirrored server-side (lead.service.ts) as the
// source of truth — this copy only lets the Kanban reject a bad drag
// instantly instead of round-tripping to the server to find out.
const NEXT_STATUSES: Record<Lead["status"], Lead["status"][]> = {
  NEW: ["CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"],
  CONTACTED: ["QUALIFIED", "PROPOSAL", "WON", "LOST"],
  QUALIFIED: ["PROPOSAL", "WON", "LOST"],
  PROPOSAL: ["WON", "LOST"],
  WON: [],
  LOST: [],
};

interface StatusConfig {
  label: string;
  bgColor: string;
}

const STATUS_CONFIG: Record<Lead["status"], Omit<StatusConfig, "label">> = {
  NEW: { bgColor: "bg-blue-100 text-blue-800" },
  CONTACTED: { bgColor: "bg-yellow-100 text-yellow-800" },
  QUALIFIED: { bgColor: "bg-purple-100 text-purple-800" },
  PROPOSAL: { bgColor: "bg-orange-100 text-orange-800" },
  WON: { bgColor: "bg-green-100 text-green-800" },
  LOST: { bgColor: "bg-red-100 text-red-800" },
};

const COLUMN_STATUSES: Lead["status"][] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "WON",
  "LOST",
];

interface SortableLeadCardProps {
  lead: Lead;
  onCreateProposal: (lead: Lead) => void;
}

function SortableLeadCard({ lead, onCreateProposal }: SortableLeadCardProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 999 : "auto",
  };

  const canCreateProposal = CAN_CREATE_PROPOSAL.includes(lead.status);

  const getStatusLabel = (status: Lead["status"]) => {
    switch (status) {
      case "NEW":
        return t("leadsPage.status.new");
      case "CONTACTED":
        return t("leadsPage.status.contacted");
      case "QUALIFIED":
        return t("leadsPage.status.qualified");
      case "PROPOSAL":
        return t("leadsPage.status.proposal");
      case "WON":
        return t("leadsPage.status.won");
      case "LOST":
        return t("leadsPage.status.lost");
      default:
        return status;
    }
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow"
    >
      <CardContent className="p-4 space-y-2">
        <div className="font-medium text-ink">{lead.name}</div>
        {lead.email && (
          <div className="text-sm text-muted-foreground truncate">{lead.email}</div>
        )}
        {lead.phone && (
          <div className="text-sm text-muted-foreground">{lead.phone}</div>
        )}
        <Badge className={STATUS_CONFIG[lead.status].bgColor}>{getStatusLabel(lead.status)}</Badge>
        {canCreateProposal && (
          <Button
            size="sm"
            variant="outline"
            className="w-full mt-2 gap-1"
            // Stop the drag sensors from claiming these events so the click registers as a click.
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onCreateProposal(lead);
            }}
          >
            <FileText className="h-3.5 w-3.5" />
            {t("proposals.fromLead.create")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface KanbanColumnProps {
  status: Lead["status"];
  leads: Lead[];
  isDragging: boolean;
  onCreateProposal: (lead: Lead) => void;
}

function KanbanColumn({ status, leads, isDragging, onCreateProposal }: KanbanColumnProps) {
  const { t } = useTranslation();
  const ids = useMemo(() => leads.map((lead) => lead.id), [leads]);
  const columnBg = status === "WON" ? "bg-green-50/50" : status === "LOST" ? "bg-red-50/50" : "bg-card";
  const parentRef = useRef<HTMLDivElement | null>(null);
  const shouldVirtualize = !isDragging && leads.length > 40;
  const virtualizer = useVirtualizer({
    count: leads.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 92,
    overscan: 10,
  });

  const getStatusLabel = (status: Lead["status"]) => {
    switch (status) {
      case "NEW":
        return t("leadsPage.status.new");
      case "CONTACTED":
        return t("leadsPage.status.contacted");
      case "QUALIFIED":
        return t("leadsPage.status.qualified");
      case "PROPOSAL":
        return t("leadsPage.status.proposal");
      case "WON":
        return t("leadsPage.status.won");
      case "LOST":
        return t("leadsPage.status.lost");
      default:
        return status;
    }
  };

  return (
    <div className="flex-1 min-w-[280px] max-w-[320px]">
      <div className={`p-3 rounded-t-lg border border-b-0 flex items-center justify-between ${columnBg}`}>
        <h3 className="font-semibold text-ink">{getStatusLabel(status)}</h3>
        <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {leads.length}
        </span>
      </div>
      <div
        ref={parentRef}
        className={`p-2 min-h-[400px] max-h-[70vh] overflow-auto rounded-b-lg border border-t-0 ${columnBg}`}
        style={{ contentVisibility: "auto" } as CSSProperties}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {shouldVirtualize ? (
            <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const lead = leads[virtualRow.index];
                if (!lead) return null;
                return (
                  <div
                    key={lead.id}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="pb-2"
                  >
                    <SortableLeadCard lead={lead} onCreateProposal={onCreateProposal} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {leads.map((lead) => (
                <SortableLeadCard key={lead.id} lead={lead} onCreateProposal={onCreateProposal} />
              ))}
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}

export const LeadsKanban = memo(function LeadsKanban({ filteredLeads }: { filteredLeads: Lead[] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { mutate: updateLeadStatus } = useUpdateLeadStatus();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [proposalLead, setProposalLead] = useState<Lead | null>(null);
  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const pendingLostRef = useRef<{ leadId: string; snapshots: ReturnType<typeof queryClient.getQueriesData> } | null>(null);

  const handleCreateProposal = useCallback((lead: Lead) => {
    setProposalLead(lead);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { groupedLeads, leadIdToStatus } = useMemo(() => {
    const groups: Record<Lead["status"], Lead[]> = {
      NEW: [],
      CONTACTED: [],
      QUALIFIED: [],
      PROPOSAL: [],
      WON: [],
      LOST: [],
    };
    const map = new Map<string, Lead["status"]>();
    for (const lead of filteredLeads) {
      groups[lead.status].push(lead);
      map.set(lead.id, lead.status);
    }
    return { groupedLeads: groups, leadIdToStatus: map };
  }, [filteredLeads]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const applyStatusChange = useCallback((leadId: string, overStatus: Lead["status"], lostReasonText?: string, snapshots?: ReturnType<typeof queryClient.getQueriesData>) => {
    updateLeadStatus(
      { id: leadId, status: overStatus, lostReason: lostReasonText || undefined },
      {
        onError: () => {
          if (snapshots) {
            for (const [key, data] of snapshots) {
              queryClient.setQueryData(key, data);
            }
          }
          toast.error(t("toasts.leadStatusUpdateError"));
        },
      }
    );
  }, [updateLeadStatus, queryClient, t]);

  const getStatusLabel = useCallback((status: Lead["status"]) => {
    switch (status) {
      case "NEW":
        return t("leadsPage.status.new");
      case "CONTACTED":
        return t("leadsPage.status.contacted");
      case "QUALIFIED":
        return t("leadsPage.status.qualified");
      case "PROPOSAL":
        return t("leadsPage.status.proposal");
      case "WON":
        return t("leadsPage.status.won");
      case "LOST":
        return t("leadsPage.status.lost");
      default:
        return status;
    }
  }, [t]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const activeStatus = leadIdToStatus.get(activeId) ?? null;
    const overId = over.id as string;
    let overStatus = leadIdToStatus.get(overId) ?? null;

    if (!activeStatus) return;

    if (!overStatus && COLUMN_STATUSES.includes(overId as Lead["status"])) {
      overStatus = overId as Lead["status"];
    }

    if (!overStatus) return;

    if (activeStatus !== overStatus) {
      if (!NEXT_STATUSES[activeStatus].includes(overStatus)) {
        toast.error(
          t("toasts.leadInvalidTransition", {
            from: getStatusLabel(activeStatus),
            to: getStatusLabel(overStatus),
          })
        );
        setActiveId(null);
        return;
      }

      // Optimistic update
      const snapshots = queryClient.getQueriesData({ queryKey: ["leads"], exact: false });
      queryClient.setQueriesData(
        { queryKey: ["leads"], exact: false },
        (old: unknown) => {
          if (!old) return old;
          if (Array.isArray(old)) {
            return old.map((lead) => (lead?.id === activeId ? { ...lead, status: overStatus } : lead));
          }
          if (typeof old === "object" && old !== null && "data" in old) {
            const o = old as { data?: unknown };
            if (Array.isArray(o.data)) {
              return {
                ...(old as object),
                data: o.data.map((lead) => {
                  if (typeof lead === "object" && lead !== null && "id" in lead && (lead as { id?: unknown }).id === activeId) {
                    return { ...(lead as object), status: overStatus };
                  }
                  return lead;
                }),
              };
            }
          }
          return old;
        }
      );

      if (overStatus === "LOST") {
        pendingLostRef.current = { leadId: activeId, snapshots };
        setLostReason("");
        setLostDialogOpen(true);
      } else {
        applyStatusChange(activeId, overStatus, undefined, snapshots);
      }
    }

    setActiveId(null);
  }, [leadIdToStatus, queryClient, applyStatusChange, getStatusLabel, t]);

  const activeLead = useMemo(
    () => (activeId ? filteredLeads.find((lead) => lead.id === activeId) ?? null : null),
    [activeId, filteredLeads]
  );

  return (
    <div className="overflow-x-auto pb-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 min-w-max">
          {COLUMN_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              leads={groupedLeads[status]}
              isDragging={!!activeId}
              onCreateProposal={handleCreateProposal}
            />
          ))}
        </div>
        <DragOverlay>
          {activeLead ? (
            <Card className="shadow-xl opacity-80">
              <CardContent className="p-4 space-y-2">
                <div className="font-medium text-ink">{activeLead.name}</div>
                {activeLead.email && (
                  <div className="text-sm text-muted-foreground truncate">{activeLead.email}</div>
                )}
                {activeLead.phone && (
                  <div className="text-sm text-muted-foreground">{activeLead.phone}</div>
                )}
                <Badge className={STATUS_CONFIG[activeLead.status].bgColor}>
                  {getStatusLabel(activeLead.status)}
                </Badge>
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      <CreateProposalFromLeadDialog
        lead={proposalLead}
        open={!!proposalLead}
        onOpenChange={(open) => {
          if (!open) setProposalLead(null);
        }}
      />

      <Dialog
        open={lostDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            // Rollback optimistic update on cancel
            if (pendingLostRef.current) {
              for (const [key, data] of pendingLostRef.current.snapshots) {
                queryClient.setQueryData(key, data);
              }
              pendingLostRef.current = null;
            }
            setLostDialogOpen(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marquer comme perdu</DialogTitle>
            <DialogDescription>
              Indiquez la raison pour laquelle ce lead est perdu (optionnel).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Ex : budget insuffisant, projet annulé, concurrent choisi..."
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            rows={3}
            maxLength={500}
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                if (pendingLostRef.current) {
                  for (const [key, data] of pendingLostRef.current.snapshots) {
                    queryClient.setQueryData(key, data);
                  }
                  pendingLostRef.current = null;
                }
                setLostDialogOpen(false);
              }}
            >
              Annuler
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (!pendingLostRef.current) return;
                const { leadId, snapshots } = pendingLostRef.current;
                pendingLostRef.current = null;
                setLostDialogOpen(false);
                applyStatusChange(leadId, "LOST", lostReason || undefined, snapshots);
              }}
            >
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});
