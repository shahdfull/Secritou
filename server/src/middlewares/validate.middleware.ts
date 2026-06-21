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
      // req.query is a read-only getter in the router package (Express v5 internals).
      // Mutate in place instead of reassigning.
      if (parsed.query) Object.assign(req.query, parsed.query);
      next();
    } catch (error) {
      next(error);
    }
  };
}