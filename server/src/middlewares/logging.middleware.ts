import { randomUUID } from "node:crypto";
import morgan from "morgan";
import type { RequestHandler } from "express";

morgan.token("req-id", (req) => (req as any).id ?? "-");

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const id = (req.headers["x-request-id"] as string | undefined) ?? randomUUID();
  (req as any).id = id;
  res.setHeader("X-Request-ID", id);
  next();
};

export const loggingMiddleware = morgan(":req-id :method :url :status :response-time ms");
