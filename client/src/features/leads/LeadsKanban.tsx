import { useState } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay, DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLeads, useUpdateLeadStatus } from "@/hooks/useLeads";
import type { Lead } from "@/types/lead";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface StatusConfig {
  label: string;
  bgColor: string;
}

const STATUS_CONFIG: Record<Lead["status"], StatusConfig> = {
  NEW: { label: "Nouveau", bgColor: "bg-blue-100 text-blue-800" },
  CONTACTED: { label: "Contacté", bgColor: "bg-yellow-100 text-yellow-800" },
  QUALIFIED: { label: "Qualifié", bgColor: "bg-purple-100 text-purple-800" },
  PROPOSAL: { label: "Proposition", bgColor: "bg-pink-100 text-pink-800" },
  WON: { label: "Gagné", bgColor: "bg-green-100 text-green-800" },
  LOST: { label: "Perdu", bgColor: "bg-red-100 text-red-800" },
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
}

function SortableLeadCard({ lead }: SortableLeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 999 : "auto",
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
        <Badge className={STATUS_CONFIG[lead.status].bgColor}>{STATUS_CONFIG[lead.status].label}</Badge>
      </CardContent>
    </Card>
  );
}

interface KanbanColumnProps {
  status: Lead["status"];
  leads: Lead[];
}

function KanbanColumn({ status, leads }: KanbanColumnProps) {
  const config = STATUS_CONFIG[status];
  const ids = leads.map((lead) => lead.id);
  const columnBg = status === "WON" ? "bg-green-50/50" : status === "LOST" ? "bg-red-50/50" : "bg-card";

  return (
    <div className="flex-1 min-w-[280px] max-w-[320px]">
      <div className={`p-3 rounded-t-lg border border-b-0 flex items-center justify-between ${columnBg}`}>
        <h3 className="font-semibold text-ink">{config.label}</h3>
        <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {leads.length}
        </span>
      </div>
      <div className={`p-2 min-h-[400px] rounded-b-lg border border-t-0 space-y-2 ${columnBg}`}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <SortableLeadCard key={lead.id} lead={lead} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export function LeadsKanban({ filteredLeads }: { filteredLeads: Lead[] }) {
  const queryClient = useQueryClient();
  const { mutate: updateLeadStatus } = useUpdateLeadStatus();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const groupLeadsByStatus = () => {
    const groups: Record<Lead["status"], Lead[]> = {
      NEW: [],
      CONTACTED: [],
      QUALIFIED: [],
      PROPOSAL: [],
      WON: [],
      LOST: [],
    };
    filteredLeads.forEach((lead) => {
      groups[lead.status].push(lead);
    });
    return groups;
  };

  const groupedLeads = groupLeadsByStatus();

  const getStatusFromId = (id: string) => {
    for (const status of COLUMN_STATUSES) {
      if (groupedLeads[status].some((lead) => lead.id === id)) {
        return status;
      }
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const activeStatus = getStatusFromId(activeId);
    const overId = over.id as string;
    let overStatus = getStatusFromId(overId);

    if (!activeStatus) return;

    if (!overStatus && COLUMN_STATUSES.includes(overId as Lead["status"])) {
      overStatus = overId as Lead["status"];
    }

    if (!overStatus) return;

    if (activeStatus !== overStatus) {
      const originalLeads = queryClient.getQueryData<Lead[]>(["leads"]);

      // Optimistic update
      queryClient.setQueryData<Lead[]>(["leads"], (oldLeads) =>
        oldLeads?.map((lead) =>
          lead.id === activeId ? { ...lead, status: overStatus } : lead
        )
      );

      updateLeadStatus(
        { id: activeId, status: overStatus },
        {
          onError: () => {
            // Rollback
            queryClient.setQueryData(["leads"], originalLeads);
            toast.error("Failed to update lead status");
          },
        }
      );
    }

    setActiveId(null);
  };

  const activeLead = activeId ? filteredLeads.find((lead) => lead.id === activeId) : null;

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
                  {STATUS_CONFIG[activeLead.status].label}
                </Badge>
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
