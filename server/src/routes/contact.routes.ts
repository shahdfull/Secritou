import { Router } from "express";
import { submitContactRequest, getContactRequests, updateContactRequest } from "../controllers/contact.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { contactRequestSchema } from "../validators/contact.validator.js";
import { authenticate } from "../middlewares/auth.middleware.js";

export const contactRoutes = Router();

contactRoutes.post("/", validate(contactRequestSchema), submitContactRequest);
contactRoutes.get("/", authenticate, getContactRequests);
contactRoutes.patch("/:id", authenticate, updateContactRequest);
