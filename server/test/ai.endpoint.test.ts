import test from "node:test";
import assert from "node:assert/strict";
import { authorize } from "../src/middlewares/rbac.middleware.js";
import { personas } from "../src/agents/personas.js";
import { extractJson } from "../src/services/agentOrchestrator.service.js";

function runMiddleware(middleware: ReturnType<typeof authorize>, req: any) {
  return new Promise<unknown>((resolve) => {
    middleware(req, {} as any, (err?: unknown) => resolve(err));
  });
}

test.describe("AI Endpoints", () => {
  test("authorize allows ADMIN and MANAGER for AI endpoints", async () => {
    const middleware = authorize("ADMIN", "MANAGER");
    
    let err = await runMiddleware(middleware, { user: { role: "ADMIN" } });
    assert.equal(err, undefined);
    
    err = await runMiddleware(middleware, { user: { role: "MANAGER" } });
    assert.equal(err, undefined);
    
    err = await runMiddleware(middleware, { user: { role: "CLIENT" } });
    assert.ok(err);
    assert.equal((err as any).statusCode, 403);
    
    err = await runMiddleware(middleware, { user: { role: "FREELANCER" } });
    assert.ok(err);
    assert.equal((err as any).statusCode, 403);
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
