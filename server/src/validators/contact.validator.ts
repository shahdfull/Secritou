import { z } from "zod";
import { isValidTunisianPhone, CONTACT_SERVICE_TYPES, CONTACT_BUDGET_OPTIONS } from "@secritou/shared";

export const contactRequestSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, "Name must contain at least 2 characters"),
    email: z.string().trim().email("Enter a valid email address"),
    // Accepts "+216XXXXXXXX" or a bare 8-digit local number (2-9 leading
    // digit); "216XXXXXXXX" without the + is rejected as ambiguous with a
    // local number. Must stay aligned with ContactPage.tsx's client-side check
    // — see shared/src/constants/phone.ts.
    phone: z.string().trim().optional().refine(
      (value) => !value || isValidTunisianPhone(value),
      "Enter a valid Tunisian phone number"
    ),
    serviceType: z.enum(CONTACT_SERVICE_TYPES),
    budget: z.enum(CONTACT_BUDGET_OPTIONS).optional(),
    company: z.string().trim().min(2, "Company must contain at least 2 characters"),
    message: z.string().trim().min(20, "Message must contain at least 20 characters"),
    // Honeypot: hidden field a human never fills. Left unconstrained (no
    // .max(0)) on purpose — a bot filling it with anything must still pass
    // validation so the controller can silently no-op instead of a 400 that
    // would tell the bot it was detected.
    website: z.string().optional(),
  }),
});

export type ContactRequestInput = z.infer<typeof contactRequestSchema>["body"];
