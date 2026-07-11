import type { RequestHandler } from "express";
import type { AnyZodObject } from "zod";

export function validate(schema: AnyZodObject): RequestHandler {
  return (req, _res, next) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        params: req.params,
        query: req.query,
      });
      req.body = parsed.body ?? req.body;
      req.params = parsed.params ?? req.params;
      // req.query is a getter-only accessor in Express v5 (no setter), so Object.assign onto it
      // silently no-ops — transformed values (e.g. string -> Date) never reach the handler.
      // Replacing the property descriptor is the only way to actually swap the value.
      if (parsed.query) {
        Object.defineProperty(req, "query", {
          value: parsed.query,
          writable: true,
          configurable: true,
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}