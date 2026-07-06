import { z } from "zod";
import { isValidTunisianPhone } from "@secritou/shared";

export const createFreelancerApplicationValidator = z.object({
  body: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
    // Accepts "+216XXXXXXXX" or a bare 8-digit local number (2-9 leading
    // digit); "216XXXXXXXX" without the + is rejected as ambiguous with a
    // local number. Must stay aligned with JoinUsPage.tsx's client-side check
    // — see shared/src/constants/phone.ts.
    phone: z.string().trim().optional().refine(
      (value) => !value || isValidTunisianPhone(value),
      "Enter a valid Tunisian phone number"
    ),
    position: z.string().min(1, "Position is required"),
    bio: z.string().min(20, "Bio must be at least 20 characters"),
    role: z.enum(["FREELANCER", "MANAGER"], { message: "Invalid role" }),
    // Files are handled separately by multer, not in JSON body
    // Honeypot: hidden field a human never fills. Left unconstrained so a bot
    // filling it still passes validation — the controller silently no-ops
    // instead of a 400 that would reveal the trap.
    website: z.string().optional(),
  }),
});

export const updateFreelancerApplicationStatusValidator = z.object({
  body: z.object({
    status: z.enum(["PENDING", "ACCEPTED", "REJECTED"]),
    rejectionReason: z.string().optional(),
  }),
});

export const acceptFreelancerApplicationValidator = z.object({
  body: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
    phone: z.string().optional(),
    role: z.enum(["FREELANCER", "MANAGER"]),
  }),
});

export const rejectFreelancerApplicationValidator = z.object({
  params: z.object({ id: z.string().uuid() }).strict(),
  body: z
    .object({
      rejectionReason: z.string().max(2000).optional(),
    })
    .strict(),
});
