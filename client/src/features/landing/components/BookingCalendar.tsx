import { useEffect, useMemo, useRef, useState } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";
import { Calendar as CalendarIcon, CheckCircle2, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Calendar as UiCalendar } from "@/components/ui/calendar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { isValidTunisianPhone } from "@secritou/shared";
import { bookBookingSlot, getOpenBookingSlots, type BookingSlotRecord } from "@/api/booking.api";
import { formatDateTime } from "@/utils/format";

const bookingSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  phone: z.string().trim().optional().refine((value) => !value || isValidTunisianPhone(value), "Invalid phone"),
  notes: z.string().trim().max(1000).optional(),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

function dateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function parseSlotDate(slot: BookingSlotRecord) {
  return new Date(slot.startTime);
}

function buildRange(view: "month" | "week", anchor: Date) {
  if (view === "week") {
    return { from: startOfWeek(anchor, { weekStartsOn: 1 }), to: endOfWeek(anchor, { weekStartsOn: 1 }) };
  }
  return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
}

export function BookingCalendar() {
  const { t } = useTranslation();
  const [view, setView] = useState<"month" | "week">("month");
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [slots, setSlots] = useState<BookingSlotRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<BookingSlotRecord | null>(null);
  const [confirmation, setConfirmation] = useState<BookingSlotRecord | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: { name: "", email: "", phone: "", notes: "" },
  });

  const range = useMemo(() => buildRange(view, anchorDate), [view, anchorDate]);

  // Read via a ref rather than a dependency: this effect itself calls setSelectedDate below, and
  // reacting to selectedDate would re-trigger the fetch it just finished (a feedback loop) instead
  // of only refetching when the visible range or refreshNonce actually change.
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getOpenBookingSlots({ fromDate: range.from.toISOString(), toDate: range.to.toISOString() })
      .then((data) => {
        if (!mounted) return;
        setSlots(data);
        if (data.length > 0) {
          const selectedStillAvailable = data.some((slot) => isSameDay(parseSlotDate(slot), selectedDateRef.current));
          if (!selectedStillAvailable) {
            setSelectedDate(parseSlotDate(data[0]));
          }
        }
      })
      .catch(() => {
        if (mounted) toast.error(t("contact.booking.loadFailed", "Unable to load availability."));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [range.from, range.to, refreshNonce, t]);

  const slotsByDay = useMemo(() => {
    const grouped = new Map<string, BookingSlotRecord[]>();
    for (const slot of slots) {
      const key = dateKey(parseSlotDate(slot));
      const current = grouped.get(key) ?? [];
      current.push(slot);
      grouped.set(key, current);
    }
    return grouped;
  }, [slots]);

  const selectedDaySlots = slotsByDay.get(dateKey(selectedDate)) ?? [];
  const availableDays = useMemo(() => Array.from(slotsByDay.keys()).map((key) => new Date(`${key}T00:00:00`)), [slotsByDay]);

  const openBookingDialog = (slot: BookingSlotRecord) => {
    setSelectedSlot(slot);
    setConfirmation(null);
    reset({ name: "", email: "", phone: "", notes: "" });
    setDialogOpen(true);
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!selectedSlot) return;
    try {
      const booking = await bookBookingSlot({
        slotId: selectedSlot.id,
        name: values.name,
        email: values.email,
        phone: values.phone || undefined,
        notes: values.notes || undefined,
      });
      setConfirmation(booking.slot);
      setRefreshNonce((value) => value + 1);
      toast.success(t("contact.booking.successToast", "Booking confirmed."));
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("just taken")) {
        toast.error(t("contact.booking.slotTaken", "That slot was just taken, please pick another."));
        setRefreshNonce((value) => value + 1);
        setDialogOpen(false);
      } else {
        toast.error(t("contact.booking.submitFailed", "Unable to submit your booking."));
      }
    }
  });

  return (
    <section className="bg-surface-warm/40 pb-24 pt-10">
      <div className="container-page">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.35fr] lg:items-start">
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {t("contact.booking.badge")}
            </p>
            <h2 className="font-display text-3xl font-bold text-ink sm:text-4xl">
              {t("contact.booking.heading")}
            </h2>
            <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
              <h3 className="font-display text-lg font-semibold text-ink">{t("contact.booking.whyTitle")}</h3>
              <ul className="mt-4 space-y-3">
                {(t("contact.booking.reasons", { returnObjects: true }) as string[]).map((reason) => (
                  <li key={reason} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {reason}
                  </li>
                ))}
              </ul>
              <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
                {t("contact.booking.footer")}
              </p>
            </div>
            <Card className="rounded-3xl border border-dashed border-border bg-card shadow-soft">
              <CardContent className="flex flex-col gap-3 p-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 font-medium text-ink">
                  <Mail className="h-4 w-4 text-primary" />
                  contact@secritou.tn
                </div>
                <p>{t("contact.booking.helpText", "If nothing fits, email us directly.")}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-3xl border border-border bg-card shadow-soft">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="font-display text-2xl text-ink">{t("contact.booking.calendarTitle", "Choose a time")}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{t("contact.booking.calendarSubtitle", "Pick a day, then select an open slot.")}</p>
              </div>
              <Tabs value={view} onValueChange={(value) => setView(value as "month" | "week")}> 
                <TabsList>
                  <TabsTrigger value="month">{t("contact.booking.monthView")}</TabsTrigger>
                  <TabsTrigger value="week">{t("contact.booking.weekView")}</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading ? (
                <div className="grid gap-4 lg:grid-cols-[1fr_0.95fr]">
                  <Skeleton className="h-[360px] rounded-2xl" />
                  <div className="space-y-3">
                    <Skeleton className="h-8 w-36" />
                    <Skeleton className="h-12 w-full rounded-2xl" />
                    <Skeleton className="h-12 w-full rounded-2xl" />
                    <Skeleton className="h-12 w-full rounded-2xl" />
                    <Skeleton className="h-12 w-full rounded-2xl" />
                  </div>
                </div>
              ) : slots.length === 0 ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-background p-10 text-center">
                  <CalendarIcon className="h-10 w-10 text-primary/40" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    {t("contact.booking.emptyState", "No availability in the next 30 days.")} <a href="mailto:contact@secritou.tn" className="font-semibold text-primary underline underline-offset-2">contact@secritou.tn</a>
                  </p>
                </div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
                  <div className="rounded-2xl border border-border bg-background p-4">
                    {view === "month" ? (
                      <UiCalendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(date)}
                        month={anchorDate}
                        onMonthChange={setAnchorDate}
                        disabled={(date) => !slotsByDay.has(dateKey(date))}
                        modifiers={{ available: availableDays }}
                      />
                    ) : (
                      <div className="grid grid-cols-7 gap-2">
                        {eachDayOfInterval({ start: range.from, end: range.to }).map((day) => {
                          const daySlots = slotsByDay.get(dateKey(day)) ?? [];
                          const active = isSameDay(day, selectedDate);
                          return (
                            <button
                              key={day.toISOString()}
                              type="button"
                              onClick={() => setSelectedDate(day)}
                              className={`rounded-2xl border p-3 text-left transition ${active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50"} ${daySlots.length === 0 ? "opacity-50" : ""}`}
                              disabled={daySlots.length === 0}
                            >
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">{format(day, "EEE")}</p>
                              <p className="mt-1 text-lg font-semibold text-ink">{format(day, "d")}</p>
                              <p className="mt-2 text-xs text-muted-foreground">{t("contact.booking.availableCount", { count: daySlots.length, defaultValue: `${daySlots.length} available` })}</p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 rounded-2xl border border-border bg-background p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t("contact.booking.selectedDay")}</p>
                        <h3 className="mt-1 font-display text-xl font-semibold text-ink">{formatDateTime(selectedDate)}</h3>
                      </div>
                      <div className="text-xs text-muted-foreground">{selectedDaySlots.length} {t("contact.booking.slots")}</div>
                    </div>

                    <div className="space-y-3">
                      {selectedDaySlots.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                          {t("contact.booking.noDaySlots", "No open slots on this day.")}
                        </div>
                      ) : (
                        selectedDaySlots.map((slot) => (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => openBookingDialog(slot)}
                            className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-left hover:border-primary/50 hover:bg-primary/5"
                          >
                            <div>
                              <p className="font-medium text-ink">{formatDateTime(slot.startTime)}</p>
                              <p className="text-xs text-muted-foreground">{formatDateTime(slot.endTime)}</p>
                            </div>
                            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{t("contact.booking.bookSlot")}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{confirmation ? t("contact.booking.successTitle") : t("contact.booking.formTitle")}</DialogTitle>
            <DialogDescription>
              {confirmation
                ? t("contact.booking.successDescription")
                : selectedSlot && `${formatDateTime(selectedSlot.startTime)} - ${formatDateTime(selectedSlot.endTime)}`}
            </DialogDescription>
          </DialogHeader>

          {confirmation ? (
            <div className="space-y-4 rounded-2xl border border-green-200 bg-green-50 p-5 text-green-800">
              <p className="text-sm font-medium">{t("contact.booking.successBody")}</p>
              <Button onClick={() => { setDialogOpen(false); setConfirmation(null); setSelectedSlot(null); }}>
                {t("contact.booking.bookAnother")}
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="booking-name">{t("contact.booking.name")}</Label>
                <Input id="booking-name" {...register("name")} />
                {errors.name?.message && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="booking-email">{t("contact.booking.email")}</Label>
                <Input id="booking-email" type="email" {...register("email")} />
                {errors.email?.message && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="booking-phone">{t("contact.booking.phone")}</Label>
                <Input id="booking-phone" type="tel" {...register("phone")} />
                {errors.phone?.message && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="booking-notes">{t("contact.booking.notes")}</Label>
                <Textarea id="booking-notes" rows={4} {...register("notes")} />
                {errors.notes?.message && <p className="text-xs text-destructive">{errors.notes.message}</p>}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t("contact.booking.cancel")}</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? t("contact.booking.submitting") : t("contact.booking.confirm")}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
