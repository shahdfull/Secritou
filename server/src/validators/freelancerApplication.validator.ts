import { z } from "zod";

export const createFreelancerApplicationValidator = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  position: z.string().min(1, "Position is required"),
  cvUrl: z.string().url("Invalid CV URL"),
  portfolioUrl: z.string().url("Invalid portfolio URL"),
});

export const updateFreelancerApplicationStatusValidator = z.object({
  status: z.enum(["PENDING", "ACCEPTED", "REJECTED"]),
  rejectionReason: z.string().optional(),
});

export const acceptFreelancerApplicationValidator = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(16, "Password must be at least 16 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  role: z.enum(["FREELANCER", "MANAGER"]),
});
