import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import logger from "../utils/logger.js";
import { HttpError } from "../utils/httpError.js";
import { emailService } from "./email.service.js";
import { bookingAdminNotificationTemplate, bookingCustomerConfirmedTemplate } from "./emailTemplates/index.js";
import { createBookingRepository, type BookingRepository } from "../repositories/booking.repository.js";
import type { BookSlotInput, CreateAvailabilitySlotInput, CreateRecurringAvailabilityInput } from "../validators/booking.validator.js";

type DbLike = typeof prisma | any;

type BookingServiceDeps = {
  db?: DbLike;
  repositoryFactory?: (db: DbLike) => BookingRepository;
  emailSender?: typeof emailService;
  adminNotificationEmail?: string;
  dashboardUrl?: string;
  now?: () => Date;
  adminName?: string;
};

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function combineDateAndMinutes(date: Date, minutes: number): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setMinutes(minutes);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function sameSlot(a: { startTime: Date; endTime: Date }, b: { startTime: Date; endTime: Date }) {
  return a.startTime.getTime() === b.startTime.getTime() && a.endTime.getTime() === b.endTime.getTime();
}

export function createBookingService(deps: BookingServiceDeps = {}) {
  const db = deps.db ?? prisma;
  const repositoryFactory = deps.repositoryFactory ?? createBookingRepository;
  const emailSender = deps.emailSender ?? emailService;
  const adminNotificationEmail = deps.adminNotificationEmail ?? env.ADMIN_NOTIFICATION_EMAIL;
  const dashboardUrl = deps.dashboardUrl ?? `${env.FRONTEND_URL}/app/booking`;
  const now = deps.now ?? (() => new Date());
  const adminName = deps.adminName ?? "Secritou";

  return {
    async listOpenSlots(fromDate = now(), toDate = addDays(now(), 30)) {
      const repo = repositoryFactory(db);
      return repo.findOpenSlots(fromDate, toDate);
    },

    async listAdminSlots(fromDate = now()) {
      const repo = repositoryFactory(db);
      return repo.findUpcomingSlots(fromDate);
    },

    async listBookings(fromDate = now()) {
      const repo = repositoryFactory(db);
      return repo.listBookings(fromDate);
    },

    async createSlots(input: CreateAvailabilitySlotInput | CreateAvailabilitySlotInput[]) {
      const repo = repositoryFactory(db);
      const slots = Array.isArray(input) ? input : [input];
      return Promise.all(slots.map((slot) => repo.createSlot({ startTime: slot.startTime, endTime: slot.endTime })));
    },

    async createRecurringSlots(input: CreateRecurringAvailabilityInput) {
      const repo = repositoryFactory(db);
      const existing = await repo.findSlotsInRange(input.startDate, input.endDate);
      const startMinutes = parseTimeToMinutes(input.dayStart);
      const endMinutes = parseTimeToMinutes(input.dayEnd);
      const allowedDays = input.daysOfWeek ?? (input.weekdaysOnly ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6]);
      const candidates: Array<{ startTime: Date; endTime: Date }> = [];

      for (let day = new Date(input.startDate); day <= input.endDate; day = addDays(day, 1)) {
        if (!allowedDays.includes(day.getDay())) continue;

        for (let cursor = startMinutes; cursor + input.intervalMinutes <= endMinutes; cursor += input.intervalMinutes) {
          const startTime = combineDateAndMinutes(day, cursor);
          const endTime = combineDateAndMinutes(day, cursor + input.intervalMinutes);
          const duplicate = existing.some((slot: any) => sameSlot(slot, { startTime, endTime })) || candidates.some((slot) => sameSlot(slot, { startTime, endTime }));
          if (!duplicate) {
            candidates.push({ startTime, endTime });
          }
        }
      }

      if (candidates.length === 0) {
        return [];
      }

      return repo.createSlots(candidates);
    },

    async deleteSlot(id: string) {
      const repo = repositoryFactory(db);
      const slot = await repo.findSlotById(id);
      if (!slot) throw new HttpError(404, "Slot not found");
      if (slot.isBooked) throw new HttpError(409, "Cannot delete a booked slot");
      await repo.deleteSlot(id);
      return slot;
    },

    async bookSlot(slotId: string, input: BookSlotInput) {
      const booking = await db.$transaction(async (tx: DbLike) => {
        const repo = repositoryFactory(tx);
        const slot = await repo.findSlotById(slotId);

        if (!slot) throw new HttpError(404, "Slot not found");
        if (slot.isBooked) throw new HttpError(409, "That slot was just taken, please pick another slot.");
        if (slot.startTime < now()) throw new HttpError(400, "Cannot book a past slot");

        const updated = await repo.markSlotBooked(slotId, true);
        if (updated.count === 0) {
          throw new HttpError(409, "That slot was just taken, please pick another slot.");
        }

        return repo.createBooking({
          slotId,
          name: input.name,
          email: input.email,
          phone: input.phone || null,
          notes: input.notes || null,
        });
      });

      const customerEmail = bookingCustomerConfirmedTemplate({
        name: booking.name,
        slotStart: booking.slot.startTime,
        slotEnd: booking.slot.endTime,
        adminEmail: adminNotificationEmail,
        notes: booking.notes,
      });
      const adminEmail = bookingAdminNotificationTemplate({
        adminName,
        customerName: booking.name,
        customerEmail: booking.email,
        customerPhone: booking.phone,
        slotStart: booking.slot.startTime,
        slotEnd: booking.slot.endTime,
        notes: booking.notes,
        dashboardUrl,
      });

      try {
        await emailSender.send({ to: booking.email, subject: customerEmail.subject, html: customerEmail.html, text: customerEmail.text });
        await emailSender.send({ to: adminNotificationEmail, subject: adminEmail.subject, html: adminEmail.html, text: adminEmail.text });
      } catch (error) {
        logger.warn({ err: error, bookingId: booking.id }, "Booking confirmed but notification email failed");
      }

      return booking;
    },

    async cancelBooking(id: string) {
      return db.$transaction(async (tx: DbLike) => {
        const repo = repositoryFactory(tx);
        const booking = await repo.findBookingById(id);
        if (!booking) throw new HttpError(404, "Booking not found");

        await repo.markSlotBooked(booking.slotId, false);
        await repo.deleteBooking(id);
        return booking;
      });
    },
  };
}

export const bookingService = createBookingService();
