import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import multer from "multer";
import * as Sentry from "@sentry/node";
import { appErrorsTotal } from "../observability/metrics.js";
import { HttpError } from "../utils/httpError.js";
import { env } from "../config/env.js";
import logger from "../utils/logger.js";

export const errorMiddleware: ErrorRequestHandler = (error, req, res, _next) => {
  const requestId = req.id;

  const withRequestId = <T extends { error: Record<string, unknown>; message: string }>(body: T) => ({
    ...body,
    requestId,
  });

  // Handle Prisma errors
  if (error instanceof Error && "code" in error && (error as { code?: unknown }).code === "P2002") {
    appErrorsTotal.inc({ type: "prisma_p2002", source: "database" });
    res.status(409).json(withRequestId({
      error: {
        code: "DUPLICATE_ENTRY",
        message: "A record with this unique field already exists",
      },
      message: "A record with this unique field already exists",
    }));
    return;
  }

  // Handle Multer errors (file upload validation failures)
  if (error instanceof multer.MulterError) {
    let statusCode = 400;
    let message = error.message;

    // Map multer error codes to appropriate HTTP status codes
    if (error.code === "LIMIT_FILE_SIZE") {
      statusCode = 413; // Payload Too Large
      message = "File exceeds maximum size limit";
    } else if (error.code === "LIMIT_PART_COUNT") {
      statusCode = 400; // Bad Request
      message = "Too many file parts";
    } else if (error.code === "LIMIT_FILE_COUNT") {
      statusCode = 400; // Bad Request
      message = "Too many files";
    }

    appErrorsTotal.inc({ type: `upload_${error.code}`, source: "multer" });
    res.status(statusCode).json(withRequestId({
      error: {
        code: `MULTER_${error.code}`,
        message,
      },
      message,
    }));
    return;
  }

  // Handle errors with custom statusCode (e.g., from fileFilter with statusCode 415).
  // Exclude HttpError: it carries a meaningful `code` (REFRESH_RACE,
  // LEAD_INVALID_TRANSITION, …) that the dedicated HttpError branch below
  // preserves — this generic branch would overwrite it with HTTP_<status>.
  if (
    error instanceof Error &&
    !(error instanceof HttpError) &&
    "statusCode" in error &&
    typeof (error as { statusCode?: unknown }).statusCode === "number"
  ) {
    const statusCode = (error as { statusCode: number }).statusCode;
    appErrorsTotal.inc({ type: `http_${statusCode}`, source: "validation" });
    res.status(statusCode).json(withRequestId({
      error: {
        code: `HTTP_${statusCode}`,
        message: error.message,
      },
      message: error.message,
    }));
    return;
  }

  if (error instanceof ZodError) {
    appErrorsTotal.inc({ type: "validation", source: "zod" });
    const details = error.flatten();
    res.status(422).json(withRequestId({
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details,
      },
      message: "Validation failed",
      issues: details,
      details,
    }));
    return;
  }

  if (error instanceof HttpError) {
    appErrorsTotal.inc({ type: `http_${error.statusCode}`, source: "application" });
    res.status(error.statusCode).json(withRequestId({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      message: error.message,
      details: error.details,
    }));
    return;
  }

  appErrorsTotal.inc({ type: "unhandled", source: "server" });
  logger.error({ err: error, path: req.path, method: req.method }, "Unhandled error");
  if (env.SENTRY_DSN) Sentry.captureException(error);
  res.status(500).json(withRequestId({
    error: {
      code: "HTTP_500",
      message: "Internal server error",
    },
    message: "Internal server error",
  }));
};
