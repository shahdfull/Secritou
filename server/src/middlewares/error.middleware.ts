import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { appErrorsTotal } from "../observability/metrics.js";
import { HttpError } from "../utils/httpError.js";

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    appErrorsTotal.inc({ type: "validation", source: "zod" });
    res.status(422).json({
      message: "Validation failed",
      issues: error.flatten(),
    });
    return;
  }

  if (error instanceof HttpError) {
    appErrorsTotal.inc({ type: `http_${error.statusCode}`, source: "application" });
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      message: error.message,
      details: error.details,
    });
    return;
  }

  appErrorsTotal.inc({ type: "unhandled", source: "server" });
  console.error(error);
  res.status(500).json({
    error: {
      code: "HTTP_500",
      message: "Internal server error",
    },
    message: "Internal server error",
  });
};
