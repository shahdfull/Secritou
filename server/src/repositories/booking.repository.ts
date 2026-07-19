import { prisma } from "../config/prisma.js";

// Accepts the full client or the (extension-aware) transaction client it hands to $transaction —
// both expose the availabilitySlot delegate.
type TxClient = Parameters<Parameters<(typeof prisma)["$transaction"]>[0]>[0];
type DbLike = typeof prisma | TxClient;

export function createBookingRepository(db: DbLike = prisma) {
  return {
    findOpenSlots(fromDate: Date, toDate: Date) {
      return db.availabilitySlot.findMany({
        where: {
          isBooked: false,
          startTime: { gte: fromDate, lte: toDate },
        },
        orderBy: { startTime: "asc" },
      });
    },

    findUpcomingSlots(fromDate: Date) {
      return db.availabilitySlot.findMany({
        where: { startTime: { gte: fromDate } },
        orderBy: { startTime: "asc" },
        include: { booking: true },
      });
    },

    findSlotsInRange(fromDate: Date, toDate: Date) {
      return db.availabilitySlot.findMany({
        where: {
          startTime: { gte: fromDate, lte: toDate },
        },
        orderBy: { startTime: "asc" },
      });
    },

    findSlotById(id: string) {
      return db.availabilitySlot.findUnique({ where: { id }, include: { booking: true } });
    },

    createSlot(data: { startTime: Date; endTime: Date }) {
      return db.availabilitySlot.create({ data });
    },

    createSlots(data: Array<{ startTime: Date; endTime: Date }>) {
      return Promise.all(data.map((slot) => db.availabilitySlot.create({ data: slot })));
    },

    deleteSlot(id: string) {
      return db.availabilitySlot.delete({ where: { id } });
    },

    markSlotBooked(id: string, isBooked: boolean) {
      return db.availabilitySlot.updateMany({ where: { id }, data: { isBooked } });
    },

    listBookings(fromDate: Date) {
      return db.booking.findMany({
        where: { slot: { startTime: { gte: fromDate } } },
        orderBy: { createdAt: "desc" },
        include: { slot: true },
      });
    },

    findBookingById(id: string) {
      return db.booking.findUnique({ where: { id }, include: { slot: true } });
    },

    createBooking(data: {
      slotId: string;
      name: string;
      email: string;
      phone?: string | null;
      notes?: string | null;
    }) {
      return db.booking.create({ data, include: { slot: true } });
    },

    deleteBooking(id: string) {
      return db.booking.delete({ where: { id } });
    },
  };
}

export type BookingRepository = ReturnType<typeof createBookingRepository>;
