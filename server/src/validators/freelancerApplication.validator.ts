import { z } from "zod";

export const createFreelancerApplicationValidator = z.object({
  body: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
    phone: z.string().optional(),
    position: z.string().min(1, "Position is required"),
    bio: z.string().min(20, "Bio must be at least 20 characters"),
    role: z.enum(["FREELANCER", "MANAGER"], { message: "Invalid role" }),
    // Files are handled separately by multer, not in JSON body
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
