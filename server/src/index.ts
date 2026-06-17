import { app } from "./app.js";
import { env } from "./config/env.js";
import { closeRedisClient } from "./cache/redis.js";
import { startMetricsCollectors, stopMetricsCollectors } from "./observability/collectors.js";
import { prisma } from "./config/prisma.js";

if (env.METRICS_ENABLED) {
  startMetricsCollectors();
}

if (env.JOBS_ENABLED) {
  void import("./jobs/index.js");
}

const server = app.listen(env.PORT, () => {
  console.log(`Secritou API listening on port ${env.PORT}`);
  if (env.METRICS_ENABLED) {
    console.log(`Prometheus metrics available at ${env.METRICS_PATH}`);
  }
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down...`);
  stopMetricsCollectors();
  await closeRedisClient();
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
