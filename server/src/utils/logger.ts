import pino from "pino";

/**
 * Structured application logger.
 *
 * Reads process.env directly (not the validated `env` object) so it can be
 * imported from anywhere — including modules that load before env validation —
 * without risking a circular import.
 *
 * In non-production it pretty-prints with colors; in production it emits
 * newline-delimited JSON for log aggregators.
 */
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

export default logger;
