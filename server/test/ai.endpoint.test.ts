import test from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import type { Role } from "@prisma/client";
import type { HttpError } from "../src/utils/httpError.js";
import type { JwtPayload } from "../src/types/auth.js";
import { authorize } from "../src/middlewares/rbac.middleware.js";
import { personas } from "../src/agents/personas.js";
import { extractJson } from "../src/services/agentOrchestrator.service.js";

function makeUser(role: Role): JwtPayload {
  return { id: "test-user", sub: "test-user", tokenType: "access", email: "test@example.com", role, clientId: null, mustChangePassword: false };
}

function runMiddleware(middleware: ReturnType<typeof authorize>, req: Partial<Request>) {
  return new Promise<unknown>((resolve) => {
    middleware(req as Request, {} as Response, (err?: unknown) => resolve(err));
  });
}

test.describe("AI Endpoints", () => {
  test("authorize allows ADMIN and MANAGER for AI endpoints", async () => {
    const middleware = authorize("ADMIN", "MANAGER");

    let err = await runMiddleware(middleware, { user: makeUser("ADMIN") });
    assert.equal(err, undefined);

    err = await runMiddleware(middleware, { user: makeUser("MANAGER") });
    assert.equal(err, undefined);

    err = await runMiddleware(middleware, { user: makeUser("CLIENT") });
    assert.ok(err);
    assert.equal((err as HttpError).statusCode, 403);

    err = await runMiddleware(middleware, { user: makeUser("FREELANCER") });
    assert.ok(err);
    assert.equal((err as HttpError).statusCode, 403);
  });

  test("personas are defined", () => {
    assert.ok(personas["brief-generator"]);
    assert.ok(personas["brief-generator"].systemPrompt);
    assert.ok(personas["task-planner"]);
    assert.ok(personas["task-planner"].systemPrompt);
  });

  test("extractJson works with various formats", () => {
    // Basic valid JSON
    assert.deepStrictEqual(
      JSON.parse(extractJson('{"cahier_des_charges": "Test"}')),
      { cahier_des_charges: "Test" }
    );
    
    // With markdown code block
    assert.deepStrictEqual(
      JSON.parse(extractJson('```json\n{"cahier_des_charges": "Test"}\n```')),
      { cahier_des_charges: "Test" }
    );
    
    // With extra text
    assert.deepStrictEqual(
      JSON.parse(extractJson('Here is the JSON: {"cahier_des_charges": "Test"}. Thank you.')),
      { cahier_des_charges: "Test" }
    );
  });
});
