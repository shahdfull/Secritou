import { Router } from "express";
import { contactRateLimit, sensitiveWriteRateLimit } from "../middlewares/rateLimit.middleware.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { bookSlotSchema, createAvailabilitySlotSchema, createRecurringAvailabilitySchema, bookingIdParamSchema, openSlotsQuerySchema } from "../validators/booking.validator.js";
import { bookSlot, cancelBooking, createRecurringSlots, createSlot, deleteSlot, listAdminSlots, listBookings, listOpenSlots } from "../controllers/booking.controller.js";

const router = Router();

router.get("/slots", validate(openSlotsQuerySchema), listOpenSlots);
router.post("/book", contactRateLimit, validate(bookSlotSchema), bookSlot);

router.get("/admin/slots", authenticate, authorize("ADMIN"), listAdminSlots);
router.post("/admin/slots", authenticate, authorize("ADMIN"), sensitiveWriteRateLimit, validate(createAvailabilitySlotSchema), createSlot);
router.post("/admin/slots/recurring", authenticate, authorize("ADMIN"), sensitiveWriteRateLimit, validate(createRecurringAvailabilitySchema), createRecurringSlots);
router.delete("/admin/slots/:id", authenticate, authorize("ADMIN"), sensitiveWriteRateLimit, validate(bookingIdParamSchema), deleteSlot);
router.get("/admin/bookings", authenticate, authorize("ADMIN"), listBookings);
router.patch("/admin/bookings/:id/cancel", authenticate, authorize("ADMIN"), sensitiveWriteRateLimit, validate(bookingIdParamSchema), cancelBooking);

export default router;
