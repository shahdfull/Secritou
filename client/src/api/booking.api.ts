import apiClient from "@/api/axios";

export type BookingSlotRecord = {
  id: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
};

export type BookingRecord = {
  id: string;
  slotId: string;
  name: string;
  email: string;
  phone?: string | null;
  notes?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  slot: BookingSlotRecord;
};

export type BookingRequest = {
  slotId: string;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
};

export async function getOpenBookingSlots(params?: { fromDate?: string; toDate?: string }): Promise<BookingSlotRecord[]> {
  const response = await apiClient.get<{ data: BookingSlotRecord[] }>("/booking/slots", { params });
  return response.data.data;
}

export async function bookBookingSlot(payload: BookingRequest): Promise<BookingRecord> {
  const response = await apiClient.post<{ data: BookingRecord }>("/booking/book", payload);
  return response.data.data;
}

export async function getAdminBookingSlots(): Promise<BookingSlotRecord[]> {
  const response = await apiClient.get<{ data: BookingSlotRecord[] }>("/booking/admin/slots");
  return response.data.data;
}

export async function createBookingSlot(payload: { startTime: string; endTime: string }): Promise<BookingSlotRecord[]> {
  const response = await apiClient.post<{ data: BookingSlotRecord[] }>("/booking/admin/slots", payload);
  return response.data.data;
}

export async function createRecurringBookingSlots(payload: {
  startDate: string;
  endDate: string;
  dayStart: string;
  dayEnd: string;
  intervalMinutes: number;
  weekdaysOnly?: boolean;
  daysOfWeek?: number[];
}): Promise<BookingSlotRecord[]> {
  const response = await apiClient.post<{ data: BookingSlotRecord[] }>("/booking/admin/slots/recurring", payload);
  return response.data.data;
}

export async function deleteBookingSlot(id: string): Promise<void> {
  await apiClient.delete(`/booking/admin/slots/${id}`);
}

export async function getAdminBookings(): Promise<BookingRecord[]> {
  const response = await apiClient.get<{ data: BookingRecord[] }>("/booking/admin/bookings");
  return response.data.data;
}

export async function cancelAdminBooking(id: string): Promise<void> {
  await apiClient.patch(`/booking/admin/bookings/${id}/cancel`);
}
