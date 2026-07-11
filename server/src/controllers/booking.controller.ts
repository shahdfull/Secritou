import type { RequestHandler } from "express";
import { bookingService } from "../services/booking.service.js";

export const listOpenSlots: RequestHandler = async (req, res, next) => {
  try {
    const fromDate = req.query.fromDate ? new Date(req.query.fromDate as string) : undefined;
    const toDate = req.query.toDate ? new Date(req.query.toDate as string) : undefined;
    const data = await bookingService.listOpenSlots(fromDate, toDate);
    res.json({ data });
  } catch (error) {
    next(error);
  }
};

export const listAdminSlots: RequestHandler = async (_req, res, next) => {
  try {
    const data = await bookingService.listAdminSlots();
    res.json({ data });
  } catch (error) {
    next(error);
  }
};

export const listBookings: RequestHandler = async (_req, res, next) => {
  try {
    const data = await bookingService.listBookings();
    res.json({ data });
  } catch (error) {
    next(error);
  }
};

export const createSlot: RequestHandler = async (req, res, next) => {
  try {
    const data = await bookingService.createSlots(req.body);
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
};

export const createRecurringSlots: RequestHandler = async (req, res, next) => {
  try {
    const data = await bookingService.createRecurringSlots(req.body);
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
};

export const deleteSlot: RequestHandler = async (req, res, next) => {
  try {
    await bookingService.deleteSlot(req.params.id as string);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const bookSlot: RequestHandler = async (req, res, next) => {
  try {
    const booking = await bookingService.bookSlot(req.body.slotId, req.body);
    res.status(201).json({ data: booking });
  } catch (error) {
    next(error);
  }
};

export const cancelBooking: RequestHandler = async (req, res, next) => {
  try {
    await bookingService.cancelBooking(req.params.id as string);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
