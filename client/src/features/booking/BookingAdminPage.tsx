import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { format, isSameDay, addDays } from "date-fns";
import { Plus, RefreshCw, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Calendar as UiCalendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ConfirmationDialog } from "@/components/shared/crud/ConfirmationDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
} from "ag-grid-community";
import {
  cancelAdminBooking,
  createBookingSlot,
  createRecurringBookingSlots,
  deleteBookingSlot,
  getAdminBookingSlots,
  getAdminBookings,
  type BookingRecord,
  type BookingSlotRecord,
} from "@/api/booking.api";
import { formatDateTime } from "@/utils/format";

const slotSchema = z.object({
  startTime: z.string().min(1),
  endTime: z.string().min(1),
});

const recurringSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  dayStart: z.string().min(1),
  dayEnd: z.string().min(1),
  intervalMinutes: z.coerce.number().int().min(15).max(240),
  weekdaysOnly: z.boolean().optional(),
});

type SlotFormValues = z.infer<typeof slotSchema>;
type RecurringFormValues = z.infer<typeof recurringSchema>;

ModuleRegistry.registerModules([AllCommunityModule]);

// Cohérent avec la migration AG Grid de TasksListView.tsx (mêmes tokens, thème clair unique).
const gridTheme = themeQuartz.withParams({
  accentColor: "#0f766e",
  headerBackgroundColor: "#f8fafc",
  headerTextColor: "#334155",
  rowHoverColor: "#f1f5f9",
  borderColor: "#e2e8f0",
  fontFamily: "inherit",
});

export function BookingAdminPage() {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMonth, setViewMonth] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<"slots" | "bookings">("slots");
  const [slots, setSlots] = useState<BookingSlotRecord[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<BookingRecord | null>(null);
  const [cancellingBooking, setCancellingBooking] = useState(false);
  const [deleteSlotTarget, setDeleteSlotTarget] = useState<BookingSlotRecord | null>(null);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);

  const slotForm = useForm<SlotFormValues>({
    resolver: zodResolver(slotSchema),
    defaultValues: { startTime: "", endTime: "" },
  });

  const recurringForm = useForm<RecurringFormValues>({
    resolver: zodResolver(recurringSchema),
    defaultValues: {
      startDate: "",
      endDate: "",
      dayStart: "09:00",
      dayEnd: "17:00",
      intervalMinutes: 30,
      weekdaysOnly: true,
    },
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [slotData, bookingData] = await Promise.all([getAdminBookingSlots(), getAdminBookings()]);
      setSlots(slotData);
      setBookings(bookingData);
    } catch {
      toast.error(t("booking.admin.loadFailed", "Impossible de charger les réservations."));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredSlots = useMemo(() => slots.filter((slot) => isSameDay(new Date(slot.startTime), selectedDate)), [slots, selectedDate]);
  const filteredBookings = useMemo(() => bookings.filter((booking) => isSameDay(new Date(booking.slot.startTime), selectedDate)), [bookings, selectedDate]);
  const selectedDaySlots = filteredSlots;
  const selectedDayBookings = filteredBookings;

  const upcomingWeekSlots = useMemo(() => {
    const sevenDayCutoff = addDays(new Date(), 7);
    return slots.filter((slot) => {
      const start = new Date(slot.startTime);
      return start >= new Date() && start <= sevenDayCutoff;
    }).length;
  }, [slots]);

  const openSlotsCount = useMemo(() => slots.filter((slot) => !slot.isBooked).length, [slots]);
  const bookedCount = useMemo(() => slots.filter((slot) => slot.isBooked).length, [slots]);

  const slotDays = useMemo(() => slots.map((slot) => new Date(slot.startTime)), [slots]);

  const handleCreateSlot = slotForm.handleSubmit(async (values) => {
    try {
      await createBookingSlot(values);
      toast.success(t("booking.admin.slotCreated", "Créneau créé."));
      setSlotDialogOpen(false);
      slotForm.reset();
      await loadData();
    } catch {
      toast.error(t("booking.admin.slotCreateFailed", "Impossible de créer le créneau."));
    }
  });

  const handleCreateRecurring = recurringForm.handleSubmit(async (values) => {
    try {
      await createRecurringBookingSlots({
        startDate: values.startDate,
        endDate: values.endDate,
        dayStart: values.dayStart,
        dayEnd: values.dayEnd,
        intervalMinutes: values.intervalMinutes,
        weekdaysOnly: values.weekdaysOnly,
        daysOfWeek: values.weekdaysOnly ? [1, 2, 3, 4, 5] : daysOfWeek,
      });
      toast.success(t("booking.admin.recurringCreated", "Créneaux récurrents créés."));
      setRecurringDialogOpen(false);
      recurringForm.reset();
      await loadData();
    } catch {
      toast.error(t("booking.admin.recurringFailed", "Impossible de générer les créneaux."));
    }
  });

  const handleDeleteSlot = useCallback(
    async (slot: BookingSlotRecord) => {
      try {
        await deleteBookingSlot(slot.id);
        toast.success(t("booking.admin.slotDeleted", "Créneau supprimé."));
        await loadData();
      } catch {
        toast.error(t("booking.admin.slotDeleteFailed", "Impossible de supprimer le créneau."));
      }
    },
    [t, loadData]
  );

  const handleCancelBooking = useCallback(
    async (booking: BookingRecord) => {
      try {
        await cancelAdminBooking(booking.id);
        toast.success(t("booking.admin.bookingCancelled", "Réservation annulée."));
        await loadData();
      } catch {
        toast.error(t("booking.admin.bookingCancelFailed", "Impossible d'annuler la réservation."));
      }
    },
    [t, loadData]
  );

  const slotStatusRenderer = useCallback(
    (params: ICellRendererParams<BookingSlotRecord>) => {
      const slot = params.data;
      if (!slot) return null;
      return (
        <div className="flex h-full items-center">
          <Badge className={slot.isBooked ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}>
            {slot.isBooked ? t("booking.admin.booked", "Réservé") : t("booking.admin.open", "Libre")}
          </Badge>
        </div>
      );
    },
    [t]
  );

  const slotActionsRenderer = useCallback(
    (params: ICellRendererParams<BookingSlotRecord>) => {
      const slot = params.data;
      if (!slot) return null;
      return (
        <div className="flex h-full items-center justify-end">
          <Button variant="ghost" size="icon" onClick={() => setDeleteSlotTarget(slot)} disabled={slot.isBooked} title={t("booking.admin.deleteSlot", "Supprimer le créneau")}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      );
    },
    [t]
  );

  const slotColumnDefs = useMemo<ColDef<BookingSlotRecord>[]>(
    () => [
      {
        headerName: t("booking.admin.slot", "Créneau"),
        flex: 2,
        cellRenderer: (params: ICellRendererParams<BookingSlotRecord>) => {
          const slot = params.data;
          if (!slot) return null;
          return (
            <div className="flex h-full flex-col justify-center">
              <p className="font-medium text-ink">{formatDateTime(slot.startTime)}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(slot.endTime)}</p>
            </div>
          );
        },
      },
      { headerName: t("booking.admin.status", "Statut"), cellRenderer: slotStatusRenderer, flex: 1 },
      { headerName: t("booking.admin.actions", "Actions"), cellRenderer: slotActionsRenderer, width: 100, sortable: false, resizable: false },
    ],
    [t, slotStatusRenderer, slotActionsRenderer]
  );

  const bookingActionsRenderer = useCallback(
    (params: ICellRendererParams<BookingRecord>) => {
      const booking = params.data;
      if (!booking) return null;
      return (
        <div className="flex h-full items-center justify-end">
          <Button variant="ghost" size="icon" onClick={() => setCancelTarget(booking)} title={t("booking.admin.cancelBooking", "Annuler la réservation")}>
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      );
    },
    [t]
  );

  const bookingColumnDefs = useMemo<ColDef<BookingRecord>[]>(
    () => [
      {
        headerName: t("booking.admin.customer", "Client"),
        flex: 1,
        cellRenderer: (params: ICellRendererParams<BookingRecord>) => {
          const booking = params.data;
          if (!booking) return null;
          return (
            <div className="flex h-full flex-col justify-center">
              <p className="font-medium text-ink">{booking.name}</p>
              <p className="text-xs text-muted-foreground">{booking.email}</p>
            </div>
          );
        },
      },
      {
        headerName: t("booking.admin.slot", "Créneau"),
        flex: 1,
        cellRenderer: (params: ICellRendererParams<BookingRecord>) => {
          const booking = params.data;
          if (!booking) return null;
          return (
            <div className="flex h-full flex-col justify-center">
              <p className="text-sm text-ink">{formatDateTime(booking.slot.startTime)}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(booking.slot.endTime)}</p>
            </div>
          );
        },
      },
      { headerName: t("booking.admin.actions", "Actions"), cellRenderer: bookingActionsRenderer, width: 100, sortable: false, resizable: false },
    ],
    [t, bookingActionsRenderer]
  );

  const jumpToToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setViewMonth(today);
  };

  const jumpToNext7Days = () => {
    const next = addDays(new Date(), 7);
    setSelectedDate(next);
    setViewMonth(next);
  };

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-border bg-gradient-to-br from-surface-warm via-card to-background p-6 shadow-soft sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {t("booking.admin.title", "Calendrier de réservation")}
            </p>
            <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">
              {t("booking.admin.subtitle", "Gérez les créneaux ouverts et les réservations pour la page Contact.")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("booking.admin.heroBody", "Créez des disponibilités, consultez la vue du jour et annulez des rendez-vous sans quitter la page.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={jumpToToday}>
              {t("booking.admin.today", "Aujourd'hui")}
            </Button>
            <Button variant="outline" onClick={jumpToNext7Days}>
              {t("booking.admin.next7Days", "7 prochains jours")}
            </Button>
          <Dialog open={slotDialogOpen} onOpenChange={setSlotDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />{t("booking.admin.addSlot", "Ajouter un créneau")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("booking.admin.addSlot", "Ajouter un créneau")}</DialogTitle>
                <DialogDescription>{t("booking.admin.addSlotDesc", "Créer un créneau de disponibilité unique.")}</DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleCreateSlot}>
                <div className="space-y-2">
                  <Label htmlFor="startTime">{t("booking.admin.startTime", "Heure de début")}</Label>
                  <Input id="startTime" type="datetime-local" {...slotForm.register("startTime")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">{t("booking.admin.endTime", "Heure de fin")}</Label>
                  <Input id="endTime" type="datetime-local" {...slotForm.register("endTime")} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setSlotDialogOpen(false)}>{t("common.cancel", "Cancel")}</Button>
                  <Button type="submit">{t("booking.admin.save", "Enregistrer")}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={recurringDialogOpen} onOpenChange={setRecurringDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><RefreshCw className="mr-2 h-4 w-4" />{t("booking.admin.generateRecurring", "Générer des créneaux récurrents")}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t("booking.admin.generateRecurring", "Générer des créneaux récurrents")}</DialogTitle>
                <DialogDescription>{t("booking.admin.generateRecurringDesc", "Créer une plage de dates, jours ouvrés uniquement, avec une fenêtre horaire et un intervalle fixe.")}</DialogDescription>
              </DialogHeader>
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleCreateRecurring}>
                <div className="space-y-2">
                  <Label htmlFor="startDate">{t("booking.admin.startDate", "Date de début")}</Label>
                  <Input id="startDate" type="date" {...recurringForm.register("startDate")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">{t("booking.admin.endDate", "Date de fin")}</Label>
                  <Input id="endDate" type="date" {...recurringForm.register("endDate")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dayStart">{t("booking.admin.dayStart", "Début de journée")}</Label>
                  <Input id="dayStart" type="time" {...recurringForm.register("dayStart")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dayEnd">{t("booking.admin.dayEnd", "Fin de journée")}</Label>
                  <Input id="dayEnd" type="time" {...recurringForm.register("dayEnd")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="intervalMinutes">{t("booking.admin.intervalMinutes", "Intervalle (minutes)")}</Label>
                  <Input id="intervalMinutes" type="number" min={15} step={15} {...recurringForm.register("intervalMinutes")} />
                </div>
                <div className="flex items-center gap-2 pt-7">
                  <Checkbox checked={recurringForm.watch("weekdaysOnly")} onCheckedChange={(checked) => recurringForm.setValue("weekdaysOnly", Boolean(checked))} />
                  <Label>{t("booking.admin.weekdaysOnly", "Jours ouvrés uniquement")}</Label>
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label>{t("booking.admin.daysOfWeek", "Jours de la semaine")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                      const active = daysOfWeek.includes(day);
                      return (
                        <button key={day} type="button" disabled={recurringForm.watch("weekdaysOnly")} onClick={() => setDaysOfWeek((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day])} className={`rounded-full border px-3 py-1 text-xs font-medium ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}>
                          {t(`booking.admin.dayNames.${day}`, String(day))}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="sm:col-span-2 flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setRecurringDialogOpen(false)}>{t("common.cancel", "Cancel")}</Button>
                  <Button type="submit">{t("booking.admin.generate", "Générer")}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card/80 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("booking.admin.statOpen", "Disponible")}</p>
            <p className="mt-1 text-2xl font-bold text-ink">{openSlotsCount}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card/80 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("booking.admin.statBooked", "Réservé")}</p>
            <p className="mt-1 text-2xl font-bold text-ink">{bookedCount}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card/80 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("booking.admin.statWeek", "7 prochains jours")}</p>
            <p className="mt-1 text-2xl font-bold text-ink">{upcomingWeekSlots}</p>
          </div>
        </div>
      </div>

      <ConfirmationDialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        onConfirm={async () => {
          if (!cancelTarget) return;
          setCancellingBooking(true);
          try {
            await handleCancelBooking(cancelTarget);
            setCancelTarget(null);
          } finally {
            setCancellingBooking(false);
          }
        }}
        isLoading={cancellingBooking}
        icon={XCircle}
        variant="destructive"
        title={t("booking.admin.cancelBookingConfirmTitle", "Annuler cette réservation ?")}
        description={
          cancelTarget && (
            <>
              {t(
                "booking.admin.cancelBookingConfirmDescription",
                "Cette action est irréversible et libère le créneau pour d'autres réservations."
              )}
              <br />
              <strong>
                {cancelTarget.name} — {formatDateTime(cancelTarget.slot.startTime)}
              </strong>
            </>
          )
        }
        checkboxLabel={
          cancelTarget &&
          t("booking.admin.cancelBookingConfirmCheckbox", {
            defaultValue: "Je confirme l'annulation de la réservation de {{name}} du {{slot}}.",
            name: cancelTarget.name,
            slot: formatDateTime(cancelTarget.slot.startTime),
          })
        }
        confirmLabel={t("common.confirm")}
        cancelLabel={t("common.cancel")}
      />

      <AlertDialog open={!!deleteSlotTarget} onOpenChange={(open) => !open && setDeleteSlotTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("booking.admin.deleteSlotConfirmTitle", "Supprimer ce créneau ?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteSlotTarget
                ? t("booking.admin.deleteSlotConfirmDescription", {
                    defaultValue: "Supprimer le créneau du {{slot}} ? Cette action est irréversible.",
                    slot: formatDateTime(deleteSlotTarget.startTime),
                  })
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteSlotTarget) return;
                void handleDeleteSlot(deleteSlotTarget);
                setDeleteSlotTarget(null);
              }}
            >
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-3xl border border-border shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <div>
              <CardTitle>{t("booking.admin.calendar", "Calendrier")}</CardTitle>
              <p className="text-sm text-muted-foreground">{t("booking.admin.calendarHint", "Les jours avec des créneaux sont mis en évidence.")}</p>
            </div>
            <Badge className="bg-primary/10 text-primary">{format(selectedDate, "PPP")}</Badge>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0">
            {loading ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Skeleton className="h-20 rounded-2xl" />
                  <Skeleton className="h-20 rounded-2xl" />
                  <Skeleton className="h-20 rounded-2xl" />
                </div>
                <Skeleton className="h-[260px] rounded-2xl" />
              </div>
            ) : (
              <UiCalendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                month={viewMonth}
                onMonthChange={setViewMonth}
                modifiers={{ available: slotDays }}
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-3xl border border-border shadow-soft">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <CardTitle>{t("booking.admin.dayView", "Vue du jour")}</CardTitle>
                  <p className="text-sm text-muted-foreground">{format(selectedDate, "EEEE, d MMMM")}</p>
                </div>
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "slots" | "bookings")}>
                  <TabsList>
                    <TabsTrigger value="slots">{t("booking.admin.upcomingSlots", "Créneaux à venir")}</TabsTrigger>
                    <TabsTrigger value="bookings">{t("booking.admin.bookings", "Réservations")}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "slots" | "bookings")}> 
                <TabsContent value="slots" className="mt-0">
                  <div style={{ height: 400 }}>
                    <AgGridReact<BookingSlotRecord>
                      theme={gridTheme}
                      rowData={loading ? [] : selectedDaySlots}
                      columnDefs={slotColumnDefs}
                      loading={loading}
                      suppressCellFocus
                      overlayNoRowsTemplate={t("booking.admin.noSlots", "Aucun créneau pour ce jour.")}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="bookings" className="mt-0">
                  <div style={{ height: 400 }}>
                    <AgGridReact<BookingRecord>
                      theme={gridTheme}
                      rowData={loading ? [] : selectedDayBookings}
                      columnDefs={bookingColumnDefs}
                      loading={loading}
                      suppressCellFocus
                      overlayNoRowsTemplate={t("booking.admin.noBookings", "Aucune réservation pour ce jour.")}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}