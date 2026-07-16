import { z } from "zod";

// Note: These messages should be translated at the component level
// by wrapping the schema in a function that accepts t()
export const createRejectFormSchema = (t: (key: string) => string) => z.object({
  rejectionReason: z.string().min(10, t("applications.rejectModal.reasonMinLength")),
});

export const createAcceptFormSchema = (t: (key: string) => string) => z.object({
  username: z.string().min(1, t("auth.nameMinLength")),
  password: z.string().min(16, t("auth.passwordMinLength")),
  firstName: z.string().min(1, t("auth.nameMinLength")),
  lastName: z.string().min(1, t("auth.nameMinLength")),
  email: z.string().email(t("auth.validEmail")),
  phone: z.string().optional(),
  role: z.enum(["FREELANCER", "MANAGER"]),
});

export type RejectForm = z.infer<ReturnType<typeof createRejectFormSchema>>;
export type AcceptForm = z.infer<ReturnType<typeof createAcceptFormSchema>>;
