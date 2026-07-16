import { useEffect, useState } from "react";
import { formatDate } from "@/utils/format";
import { useProjectMeetings, useCreateProjectMeeting, useMeetingSchedule, useSetMeetingSchedule } from "@/hooks/useProjectMeetings";
import type { MeetingFrequency } from "@/api/projectMeetings.api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Users, CalendarClock } from "lucide-react";

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

export function ProjectMeetingsTab({ projectId }: Props) {
  const { data: meetings, isLoading, isError } = useProjectMeetings(projectId);
  const { mutate: createMeeting, isPending } = useCreateProjectMeeting(projectId);

  const today = () => new Date().toISOString().slice(0, 10);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(today);
  const [participants, setParticipants] = useState("");
  const [notes, setNotes] = useState("");

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
      ) : meetings && meetings.length > 0 ? (
        <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
          {meetings.map((m) => (
            <div key={m.id} className="px-4 py-3 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink">{formatDate(m.meetingDate)}</p>
                {m.createdBy && (
                  <p className="text-xs text-muted-foreground">{m.createdBy.name}</p>
                )}
              </div>
              {m.participants && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {m.participants}
                </p>
              )}
              {m.notes && (
                <p className="text-sm text-ink/80 whitespace-pre-wrap">{m.notes}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground py-8">
          Aucune réunion enregistrée pour ce projet.
        </p>
      )}
    </div>
  );
}
