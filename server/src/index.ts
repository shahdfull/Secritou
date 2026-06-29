import * as Sentry from "@sentry/node";
import { app } from "./app.js";
import { env } from "./config/env.js";
import logger from "./utils/logger.js";

if (env.SENTRY_DSN) {
  Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV });
}
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
  logger.info(`Secritou API listening on port ${env.PORT}`);
  if (env.METRICS_ENABLED) {
    logger.info(`Prometheus metrics available at ${env.METRICS_PATH}`);
  }
});

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down...`);
  stopMetricsCollectors();
  await closeRedisClient();
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
