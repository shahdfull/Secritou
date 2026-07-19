import test, { describe } from "node:test";
import assert from "node:assert/strict";
import type { HttpError } from "../src/utils/httpError.js";
import { createBookingService } from "../src/services/booking.service.js";

type FakeBooking = {
  id: string;
  slotId: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  slot: { id: string; startTime: Date; endTime: Date; isBooked: boolean };
};

function makeWorld() {
  const slot = {
    id: "slot-1",
    startTime: new Date(Date.now() + 86_400_000),
    endTime: new Date(Date.now() + 86_400_000 + 30 * 60 * 1000),
    isBooked: false,
  };

  const state = {
    slot: { ...slot },
    bookings: [] as FakeBooking[],
  };

  let bookingSeq = 0;

  const db = {
    $transaction: async <T>(callback: (tx: typeof db) => Promise<T>) => callback(db),
    availabilitySlot: {
      findMany: async () => [state.slot],
      findUnique: async ({ where }: { where: { id: string } }) => (state.slot.id === where.id ? { ...state.slot, booking: null } : null),
      create: async () => state.slot,
      updateMany: async ({ where, data }: { where: { id: string }; data: { isBooked: boolean } }) => {
        if (state.slot.id !== where.id) return { count: 0 };
        if (data.isBooked && state.slot.isBooked) return { count: 0 };
        state.slot.isBooked = data.isBooked;
        return { count: 1 };
      },
      delete: async ({ where }: { where: { id: string } }) => {
        if (state.slot.id !== where.id) throw new Error("missing slot");
        return state.slot;
      },
    },
    booking: {
      findMany: async () => state.bookings,
      findUnique: async ({ where }: { where: { id: string } }) => state.bookings.find((booking) => booking.id === where.id) ?? null,
      create: async ({ data }: { data: { slotId: string; name: string; email: string; phone?: string | null; notes?: string | null } }) => {
        const booking = {
          id: `booking-${++bookingSeq}`,
          slotId: data.slotId,
          name: data.name,
          email: data.email,
          phone: data.phone ?? null,
          notes: data.notes ?? null,
          status: "CONFIRMED",
          createdAt: new Date(),
          updatedAt: new Date(),
          slot: { ...state.slot },
        };
        state.bookings.push(booking);
        return booking;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const index = state.bookings.findIndex((booking) => booking.id === where.id);
        if (index === -1) throw new Error("missing booking");
        const [removed] = state.bookings.splice(index, 1);
        return removed;
      },
    },
  };

  const service = createBookingService({
    db,
    now: () => new Date(),
    emailSender: { send: async () => undefined } as unknown as Parameters<typeof createBookingService>[0]["emailSender"],
    adminNotificationEmail: "hello@secritou.com",
    repositoryFactory: (client) => ({
      findOpenSlots: async () => [state.slot],
      findUpcomingSlots: async () => [state.slot],
      findSlotsInRange: async () => [state.slot],
      findSlotById: async (id: string) => client.availabilitySlot.findUnique({ where: { id } }),
      createSlot: async (data: { startTime: Date; endTime: Date }) => client.availabilitySlot.create({ data }),
      createSlots: async (data: Array<{ startTime: Date; endTime: Date }>) => data.map((item) => ({ id: `created-${item.startTime.toISOString()}`, ...item, isBooked: false })),
      deleteSlot: async (id: string) => client.availabilitySlot.delete({ where: { id } }),
      markSlotBooked: async (id: string, isBooked: boolean) => client.availabilitySlot.updateMany({ where: { id }, data: { isBooked } }),
      listBookings: async () => state.bookings,
      findBookingById: async (id: string) => client.booking.findUnique({ where: { id } }),
      createBooking: async (data: { slotId: string; name: string; email: string; phone?: string | null; notes?: string | null }) => client.booking.create({ data }),
      deleteBooking: async (id: string) => client.booking.delete({ where: { id } }),
    }),
  });

  return { service, state };
}

describe("booking.service", () => {
  test("bookSlot rejects a nonexistent slot", async () => {
    const { service } = makeWorld();
    await assert.rejects(
      () => service.bookSlot("missing-slot", { slotId: "missing-slot", name: "Jane Doe", email: "jane@example.com" }),
      (error: HttpError) => error?.statusCode === 404
    );
  });

  test("bookSlot rejects an already booked slot", async () => {
    const { service, state } = makeWorld();
    state.slot.isBooked = true;
    await assert.rejects(
      () => service.bookSlot("slot-1", { slotId: "slot-1", name: "Jane Doe", email: "jane@example.com" }),
      (error: HttpError) => error?.statusCode === 409
    );
  });

  test("bookSlot handles a race and only one caller wins", async () => {
    const { service, state } = makeWorld();

    const results = await Promise.allSettled([
      service.bookSlot("slot-1", { slotId: "slot-1", name: "Jane Doe", email: "jane@example.com" }),
      service.bookSlot("slot-1", { slotId: "slot-1", name: "John Doe", email: "john@example.com" }),
    ]);

    assert.equal(state.bookings.length, 1);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  });

  test("cancelBooking frees the slot", async () => {
    const { service, state } = makeWorld();
    const booking = await service.bookSlot("slot-1", { slotId: "slot-1", name: "Jane Doe", email: "jane@example.com" });
    assert.equal(state.slot.isBooked, true);

    await service.cancelBooking(booking.id);
    assert.equal(state.slot.isBooked, false);
    assert.equal(state.bookings.length, 0);
  });
});
