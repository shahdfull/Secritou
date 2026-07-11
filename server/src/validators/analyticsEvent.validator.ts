import { z } from "zod";

// Serialized `properties` payload is capped separately (5KB) in the controller,
// since zod validates shape/types but not total JSON byte size.
export const MAX_PROPERTIES_BYTES = 5 * 1024;

export const analyticsEventSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(1, "Event name is required")
      .max(100, "Event name is too long")
      .regex(/^[a-zA-Z0-9_]+$/, "Event name must be alphanumeric with underscores only"),
    properties: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    sessionId: z.string().uuid("sessionId must be a valid UUID"),
    pagePath: z.string().trim().max(500).optional(),
    pageUrl: z.string().trim().max(2000).optional(),
    referrer: z.string().trim().max(2000).optional(),
  }),
});

export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>["body"];
