import { z } from "zod";

const serviceTypes = [
  "Business Performance",
  "Digital Growth",
  "Technology Solutions",
  "AI & Automation",
  "Other"
] as const;

const budgetOptions = [
  "< 1 000 DT",
  "1 000–5 000 DT",
  "5 000–15 000 DT",
  "+15 000 DT"
] as const;

export const contactRequestSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, "Name must contain at least 2 characters"),
    email: z.string().trim().email("Enter a valid email address"),
    phone: z.string().optional(),
    serviceType: z.enum(serviceTypes),
    budget: z.enum(budgetOptions).optional(),
    company: z.string().trim().min(2, "Company must contain at least 2 characters"),
    message: z.string().trim().min(20, "Message must contain at least 20 characters"),
  }),
});

export type ContactRequestInput = z.infer<typeof contactRequestSchema>["body"];
