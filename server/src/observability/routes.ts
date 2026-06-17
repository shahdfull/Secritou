import { Router } from "express";
import { z } from "zod";
import { registry, webVitalValue, webVitalsTotal } from "./metrics.js";

export const metricsRoutes = Router();

const webVitalSchema = z.object({
  name: z.enum(["LCP", "INP", "CLS", "TTFB", "FCP"]),
  value: z.number().nonnegative(),
  rating: z.enum(["good", "needs-improvement", "poor"]),
  id: z.string().optional(),
  navigationType: z.string().optional(),
  route: z.string().max(200).default("/"),
});

metricsRoutes.post("/web-vitals", (req, res) => {
  const parsed = webVitalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ message: "Invalid web vital payload" });
    return;
  }

  const { name, value, rating, route } = parsed.data;
  const metricValue = name === "CLS" ? value * 1000 : value;

  webVitalValue.observe({ name, rating, route }, metricValue);
  webVitalsTotal.inc({ name, rating });

  res.status(204).end();
});

export async function metricsHandler(_req: import("express").Request, res: import("express").Response) {
  res.set("Content-Type", registry.contentType);
  res.end(await registry.metrics());
}
