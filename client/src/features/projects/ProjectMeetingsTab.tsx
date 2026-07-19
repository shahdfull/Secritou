import { useEffect, useState } from "react";
import { formatDate } from "@/utils/format";
import {
  useProjectMeetings,
  useCreateProjectMeeting,
  useUpdateProjectMeeting,
  useDeleteProjectMeeting,
  useMeetingSchedule,
  useSetMeetingSchedule,
} from "@/hooks/useProjectMeetings";
import type { MeetingFrequency, ProjectMeeting } from "@/api/projectMeetings.api";
import { useMe } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDeleteDialog } from "@/components/shared/crud/ConfirmDeleteDialog";
import { DataTablePagination } from "@/components/common/DataTablePagination";
import { Plus, X, Users, CalendarClock, Edit, Trash2 } from "lucide-react";

interface Props {
  projectId: string;
}

const FREQUENCY_LABELS: Record<MeetingFrequency, string> = {
  NONE: "Aucune",
  WEEKLY: "Hebdomadaire",
  BIWEEKLY: "Toutes les 2 semaines",
  MONTHLY: "Mensuelle",
};

function MeetingScheduleCard({ projectId }: Props) {
  const { data: schedule, isLoading } = useMeetingSchedule(projectId);
  const { mutate: setSchedule, isPending } = useSetMeetingSchedule(projectId);

  const [frequency, setFrequency] = useState<MeetingFrequency>("NONE");
  const [nextDate, setNextDate] = useState("");

  useEffect(() => {
    if (!schedule) return;
    setFrequency(schedule.meetingFrequency);
    setNextDate(schedule.nextMeetingDate ? schedule.nextMeetingDate.slice(0, 10) : "");
  }, [schedule]);

  const handleSave = () => {
    if (frequency !== "NONE" && !nextDate) return;
    setSchedule({
      frequency,
      nextMeetingDate: frequency === "NONE" ? undefined : new Date(nextDate).toISOString(),
    });
  };

  if (isLoading) return <Skeleton className="h-24 w-full rounded-xl" />;

  return (
    <Card className="rounded-2xl border border-border shadow-none">
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <CalendarClock className="h-4 w-4" />
          Cadence de réunion récurrente
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Fréquence</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as MeetingFrequency)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(FREQUENCY_LABELS) as MeetingFrequency[]).map((f) => (
                  <SelectItem key={f} value={f}>{FREQUENCY_LABELS[f]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {frequency !== "NONE" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Prochaine réunion</Label>
              <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isPending || (frequency !== "NONE" && !nextDate)}
            className="h-8 text-xs"
          >
            Enregistrer la cadence
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const MEETINGS_PAGE_SIZE = 10;

// SEC-055 (F6): a meeting can now be edited/deleted, but only by its own author or an ADMIN — the
// server is the real authority (403 MEETING_NOT_YOURS), this is only to avoid showing controls
// that will predictably be refused.
function canEditMeeting(meeting: ProjectMeeting, currentUserId: string | undefined, isAdmin: boolean): boolean {
  return isAdmin || (!!currentUserId && meeting.createdBy?.id === currentUserId);
}

interface MeetingCardProps {
  meeting: ProjectMeeting;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function MeetingCard({ meeting, canEdit, onEdit, onDelete }: MeetingCardProps) {
  return (
    <div className="px-4 py-3 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">{formatDate(meeting.meetingDate)}</p>
        <div className="flex items-center gap-2">
          {meeting.createdBy && (
            <p className="text-xs text-muted-foreground">{meeting.createdBy.name}</p>
          )}
          {canEdit && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Modifier" onClick={onEdit}>
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50"
                aria-label="Supprimer"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
      {meeting.participants && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Users className="h-3 w-3" />
          {meeting.participants}
        </p>
      )}
      {meeting.notes && (
        <p className="text-sm text-ink/80 whitespace-pre-wrap">{meeting.notes}</p>
      )}
    </div>
  );
}

export function ProjectMeetingsTab({ projectId }: Props) {
  const { user } = useMe();
  const isAdmin = user?.role === "ADMIN";
  const [page, setPage] = useState(1);
  const { data: meetingsResult, isLoading, isError } = useProjectMeetings(projectId, true, page, MEETINGS_PAGE_SIZE);
  const meetings = meetingsResult?.data ?? [];
  const total = meetingsResult?.total ?? 0;
  const { mutate: createMeeting, isPending } = useCreateProjectMeeting(projectId);
  const { mutate: updateMeeting, isPending: isUpdating } = useUpdateProjectMeeting(projectId);
  const { mutate: deleteMeeting, isPending: isDeleting } = useDeleteProjectMeeting(projectId);

  const today = () => new Date().toISOString().slice(0, 10);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(today);
  const [participants, setParticipants] = useState("");
  const [notes, setNotes] = useState("");

  const [editingMeeting, setEditingMeeting] = useState<ProjectMeeting | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editParticipants, setEditParticipants] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [deletingMeeting, setDeletingMeeting] = useState<ProjectMeeting | null>(null);

  const handleSubmit = () => {
    if (!date) return;
    createMeeting(
      { meetingDate: new Date(date).toISOString(), participants: participants.trim() || undefined, notes: notes.trim() || undefined },
      {
        onSuccess: () => {
          setShowForm(false);
          setParticipants("");
          setNotes("");
          setDate(today());
        },
      }
    );
  };

  const startEdit = (meeting: ProjectMeeting) => {
    setEditingMeeting(meeting);
    setEditDate(meeting.meetingDate.slice(0, 10));
    setEditParticipants(meeting.participants ?? "");
    setEditNotes(meeting.notes ?? "");
  };

  const handleUpdate = () => {
    if (!editingMeeting || !editDate) return;
    updateMeeting(
      {
        meetingId: editingMeeting.id,
        data: {
          meetingDate: new Date(editDate).toISOString(),
          participants: editParticipants.trim() || undefined,
          notes: editNotes.trim() || undefined,
        },
      },
      { onSuccess: () => setEditingMeeting(null) }
    );
  };

  const handleConfirmDelete = () => {
    if (!deletingMeeting) return;
    deleteMeeting(deletingMeeting.id, { onSuccess: () => setDeletingMeeting(null) });
  };

  return (
    <div className="space-y-4">
      <MeetingScheduleCard projectId={projectId} />

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Réunions</h3>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)} className="h-8 text-xs gap-1">
            <Plus className="h-3.5 w-3.5" />
            Ajouter un point
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="rounded-2xl border border-border shadow-none">
          <CardContent className="pt-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Participants (optionnel)</Label>
              <Input
                placeholder="Ex: Client, chef de projet..."
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes / décisions (optionnel)</Label>
              <Textarea
                placeholder="Ce qui a été décidé..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} className="gap-1 h-8 text-xs">
                <X className="h-3.5 w-3.5" />
                Annuler
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={isPending || !date} className="h-8 text-xs">
                Enregistrer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : isError ? (
        <p className="text-center text-sm text-red-600 py-8">
          Impossible de charger les réunions. Veuillez réessayer.
        </p>
      ) : meetings.length > 0 ? (
        <>
          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {meetings.map((m) => (
              <MeetingCard
                key={m.id}
                meeting={m}
                canEdit={canEditMeeting(m, user?.id, isAdmin)}
                onEdit={() => startEdit(m)}
                onDelete={() => setDeletingMeeting(m)}
              />
            ))}
          </div>
          <DataTablePagination page={page} pageSize={MEETINGS_PAGE_SIZE} total={total} onPageChange={setPage} />
        </>
      ) : (
        <p className="text-center text-sm text-muted-foreground py-8">
          Aucune réunion enregistrée pour ce projet.
        </p>
      )}

      {editingMeeting && (
        <Card className="rounded-2xl border border-border shadow-none">
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">Modifier la réunion</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Participants (optionnel)</Label>
              <Input
                placeholder="Ex: Client, chef de projet..."
                value={editParticipants}
                onChange={(e) => setEditParticipants(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes / décisions (optionnel)</Label>
              <Textarea
                placeholder="Ce qui a été décidé..."
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setEditingMeeting(null)} className="gap-1 h-8 text-xs">
                <X className="h-3.5 w-3.5" />
                Annuler
              </Button>
              <Button size="sm" onClick={handleUpdate} disabled={isUpdating || !editDate} className="h-8 text-xs">
                Enregistrer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDeleteDialog
        open={!!deletingMeeting}
        onOpenChange={(open) => { if (!open) setDeletingMeeting(null); }}
        onConfirm={handleConfirmDelete}
        title="Supprimer cette réunion ?"
        description="Cette action est irréversible. La réunion sera définitivement supprimée."
        isDeleting={isDeleting}
      />
    </div>
  );
}
