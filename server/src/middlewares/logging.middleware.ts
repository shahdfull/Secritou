import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import morgan from "morgan";
import type { RequestHandler } from "express";

// morgan types its request as http.IncomingMessage; requestIdMiddleware stamps `id` on it.
morgan.token("req-id", (req: IncomingMessage & { id?: string }) => req.id ?? "-");

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const id = (req.headers["x-request-id"] as string | undefined) ?? randomUUID();
  req.id = id;
  res.setHeader("X-Request-ID", id);
  next();
};

export const loggingMiddleware = morgan(":req-id :method :url :status :response-time ms");
