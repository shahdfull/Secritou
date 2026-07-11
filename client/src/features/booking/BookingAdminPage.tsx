import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { format, isSameDay, addDays, startOfMonth, endOfMonth } from "date-fns";
import { Plus, RefreshCw, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Calendar as UiCalendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

function slotDateKey(slot: BookingSlotRecord) {
  return format(new Date(slot.startTime), "yyyy-MM-dd");
}

function statusBadgeColor(status: string) {
  return status === "CONFIRMED" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700";
}

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

  const loadData = async () => {
    setLoading(true);
    try {
      const [slotData, bookingData] = await Promise.all([getAdminBookingSlots(), getAdminBookings()]);
      setSlots(slotData);
      setBookings(bookingData);
    } catch {
      toast.error(t("booking.admin.loadFailed", "Unable to load bookings."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const monthStart = useMemo(() => startOfMonth(viewMonth), [viewMonth]);
  const monthEnd = useMemo(() => endOfMonth(viewMonth), [viewMonth]);

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
  const monthSlots = useMemo(
    () => slots.filter((slot) => {
      const start = new Date(slot.startTime);
      return start >= monthStart && start <= monthEnd;
    }),
    [slots, monthStart, monthEnd]
  );

  const slotDays = useMemo(() => slots.map((slot) => new Date(slot.startTime)), [slots]);

  const handleCreateSlot = slotForm.handleSubmit(async (values) => {
    try {
      await createBookingSlot(values);
      toast.success(t("booking.admin.slotCreated", "Slot created."));
      setSlotDialogOpen(false);
      slotForm.reset();
      await loadData();
    } catch {
      toast.error(t("booking.admin.slotCreateFailed", "Unable to create the slot."));
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
      toast.success(t("booking.admin.recurringCreated", "Recurring slots created."));
      setRecurringDialogOpen(false);
      recurringForm.reset();
      await loadData();
    } catch {
      toast.error(t("booking.admin.recurringFailed", "Unable to generate slots."));
    }
  });

  const handleDeleteSlot = async (slot: BookingSlotRecord) => {
    try {
      await deleteBookingSlot(slot.id);
      toast.success(t("booking.admin.slotDeleted", "Slot deleted."));
      await loadData();
    } catch {
      toast.error(t("booking.admin.slotDeleteFailed", "Unable to delete the slot."));
    }
  };

  const handleCancelBooking = async (booking: BookingRecord) => {
    try {
      await cancelAdminBooking(booking.id);
      toast.success(t("booking.admin.bookingCancelled", "Booking cancelled."));
      await loadData();
    } catch {
      toast.error(t("booking.admin.bookingCancelFailed", "Unable to cancel the booking."));
    }
  };

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
              {t("booking.admin.title", "Booking calendar")}
            </p>
            <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">
              {t("booking.admin.subtitle", "Manage open slots and bookings for the public contact page.")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("booking.admin.heroBody", "Create availability, inspect the day view, and cancel bookings without leaving the page.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={jumpToToday}>
              {t("booking.admin.today", "Today")}
            </Button>
            <Button variant="outline" onClick={jumpToNext7Days}>
              {t("booking.admin.next7Days", "Next 7 days")}
            </Button>
          <Dialog open={slotDialogOpen} onOpenChange={setSlotDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />{t("booking.admin.addSlot", "Add slot")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("booking.admin.addSlot", "Add slot")}</DialogTitle>
                <DialogDescription>{t("booking.admin.addSlotDesc", "Create a single availability slot.")}</DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleCreateSlot}>
                <div className="space-y-2">
                  <Label htmlFor="startTime">{t("booking.admin.startTime", "Start time")}</Label>
                  <Input id="startTime" type="datetime-local" {...slotForm.register("startTime")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">{t("booking.admin.endTime", "End time")}</Label>
                  <Input id="endTime" type="datetime-local" {...slotForm.register("endTime")} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setSlotDialogOpen(false)}>{t("common.cancel", "Cancel")}</Button>
                  <Button type="submit">{t("booking.admin.save", "Save")}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={recurringDialogOpen} onOpenChange={setRecurringDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><RefreshCw className="mr-2 h-4 w-4" />{t("booking.admin.generateRecurring", "Generate recurring slots")}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t("booking.admin.generateRecurring", "Generate recurring slots")}</DialogTitle>
                <DialogDescription>{t("booking.admin.generateRecurringDesc", "Create a date range, weekdays only, with a fixed time window and interval.")}</DialogDescription>
              </DialogHeader>
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleCreateRecurring}>
                <div className="space-y-2">
                  <Label htmlFor="startDate">{t("booking.admin.startDate", "Start date")}</Label>
                  <Input id="startDate" type="date" {...recurringForm.register("startDate")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">{t("booking.admin.endDate", "End date")}</Label>
                  <Input id="endDate" type="date" {...recurringForm.register("endDate")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dayStart">{t("booking.admin.dayStart", "Day start")}</Label>
                  <Input id="dayStart" type="time" {...recurringForm.register("dayStart")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dayEnd">{t("booking.admin.dayEnd", "Day end")}</Label>
                  <Input id="dayEnd" type="time" {...recurringForm.register("dayEnd")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="intervalMinutes">{t("booking.admin.intervalMinutes", "Interval minutes")}</Label>
                  <Input id="intervalMinutes" type="number" min={15} step={15} {...recurringForm.register("intervalMinutes")} />
                </div>
                <div className="flex items-center gap-2 pt-7">
                  <Checkbox checked={recurringForm.watch("weekdaysOnly")} onCheckedChange={(checked) => recurringForm.setValue("weekdaysOnly", Boolean(checked))} />
                  <Label>{t("booking.admin.weekdaysOnly", "Weekdays only")}</Label>
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label>{t("booking.admin.daysOfWeek", "Days of week")}</Label>
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
                  <Button type="submit">{t("booking.admin.generate", "Generate")}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card/80 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("booking.admin.statOpen", "Open")}</p>
            <p className="mt-1 text-2xl font-bold text-ink">{openSlotsCount}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card/80 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("booking.admin.statBooked", "Booked")}</p>
            <p className="mt-1 text-2xl font-bold text-ink">{bookedCount}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card/80 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("booking.admin.statWeek", "Next 7 days")}</p>
            <p className="mt-1 text-2xl font-bold text-ink">{upcomingWeekSlots}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-3xl border border-border shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <div>
              <CardTitle>{t("booking.admin.calendar", "Calendar")}</CardTitle>
              <p className="text-sm text-muted-foreground">{t("booking.admin.calendarHint", "Days with availability are highlighted.")}</p>
            </div>
            <Badge className="bg-primary/10 text-primary">{format(selectedDate, "PPP")}</Badge>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0">
            {loading ? (
              <Skeleton className="h-[380px] rounded-2xl" />
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
                  <CardTitle>{t("booking.admin.dayView", "Day view")}</CardTitle>
                  <p className="text-sm text-muted-foreground">{format(selectedDate, "EEEE, d MMMM")}</p>
                </div>
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "slots" | "bookings")}>
                  <TabsList>
                    <TabsTrigger value="slots">{t("booking.admin.upcomingSlots", "Slots")}</TabsTrigger>
                    <TabsTrigger value="bookings">{t("booking.admin.bookings", "Bookings")}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "slots" | "bookings")}> 
                <TabsContent value="slots" className="mt-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("booking.admin.slot", "Slot")}</TableHead>
                        <TableHead>{t("booking.admin.status", "Status")}</TableHead>
                        <TableHead className="text-right">{t("booking.admin.actions", "Actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(loading ? [] : selectedDaySlots).map((slot) => (
                        <TableRow key={slot.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-ink">{formatDateTime(slot.startTime)}</p>
                              <p className="text-xs text-muted-foreground">{formatDateTime(slot.endTime)}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={slot.isBooked ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}>{slot.isBooked ? t("booking.admin.booked", "Booked") : t("booking.admin.open", "Open")}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteSlot(slot)} disabled={slot.isBooked} title={t("booking.admin.deleteSlot", "Delete slot")}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!loading && selectedDaySlots.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">{t("booking.admin.noSlots", "No slots for this day.")}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="bookings" className="mt-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("booking.admin.customer", "Customer")}</TableHead>
                        <TableHead>{t("booking.admin.slot", "Slot")}</TableHead>
                        <TableHead className="text-right">{t("booking.admin.actions", "Actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(loading ? [] : selectedDayBookings).map((booking) => (
                        <TableRow key={booking.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-ink">{booking.name}</p>
                              <p className="text-xs text-muted-foreground">{booking.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-ink">{formatDateTime(booking.slot.startTime)}</p>
                            <p className="text-xs text-muted-foreground">{formatDateTime(booking.slot.endTime)}</p>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleCancelBooking(booking)} title={t("booking.admin.cancelBooking", "Cancel booking")}>
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!loading && selectedDayBookings.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">{t("booking.admin.noBookings", "No bookings for this day.")}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
