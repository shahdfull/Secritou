import { z } from "zod";

export const documentSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  type: z.enum(["INVOICE", "CONTRACT", "OTHER"]),
  url: z.string().url("URL invalide"),
});

export type DocumentForm = z.infer<typeof documentSchema>;
