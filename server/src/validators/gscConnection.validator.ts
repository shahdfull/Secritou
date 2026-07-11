import { z } from "zod";

const uuidParam = z.string().uuid();

export const clientIdParamSchema = z.object({
  params: z.object({ clientId: uuidParam }),
});

export const completeGscConnectSchema = z.object({
  params: z.object({ clientId: uuidParam }),
  body: z.object({
    pendingId: z.string().uuid(),
    siteUrl: z.string().min(1).max(500),
  }),
});
