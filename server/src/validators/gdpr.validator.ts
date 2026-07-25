// GDPR Validators — param-only schemas, no request body (see gdpr.service.ts / RG-025).
import { z } from "zod";

const idParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }).strict(),
});

export const gdprClientExportSchema = idParamSchema;
export const gdprClientEraseSchema = idParamSchema;
export const gdprUserExportSchema = idParamSchema;
export const gdprUserEraseSchema = idParamSchema;
export const gdprLeadExportSchema = idParamSchema;
export const gdprLeadEraseSchema = idParamSchema;
export const gdprContactRequestExportSchema = idParamSchema;
export const gdprContactRequestEraseSchema = idParamSchema;

// Self-service (SEC-224): no :id param — identity always comes from req.user, never a URL param.
export const gdprMeSchema = z.object({ params: z.object({}).strict() });
