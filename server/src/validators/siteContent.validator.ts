import { z } from "zod";

export const upsertSiteContentSchema = z.object({
  body: z
    .object({
      key: z.string().min(1).max(120),
      locale: z.enum(["fr", "en"]),
      value: z.string(),
    })
    .strict(),
});
