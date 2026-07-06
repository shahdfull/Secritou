import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { ContactService } from "../src/services/contact.service.js";
import { submitContactRequest } from "../src/controllers/contact.controller.js";
import { createApplication } from "../src/controllers/freelancerApplication.controller.js";
import { freelancerApplicationService } from "../src/services/freelancerApplication.service.js";

function fakeRes() {
  const res: any = {
    statusCode: undefined as number | undefined,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

describe("honeypot (audit 03 #5)", () => {
  test("contact form: website filled in -> 200 success, sendContactMessage never called", async (t) => {
    const spy = t.mock.method(ContactService.prototype, "sendContactMessage", async () => {
      throw new Error("should not be called");
    });

    const req: any = { body: { website: "http://spam.example" }, ip: "1.2.3.4" };
    const res = fakeRes();
    const next = t.mock.fn();

    await submitContactRequest(req, res, next);

    assert.equal(spy.mock.callCount(), 0);
    assert.equal(res.statusCode, 200);
    assert.equal((res.body as any).success, true);
    assert.equal(next.mock.callCount(), 0);
  });

  test("contact form: website empty -> normal flow still runs", async (t) => {
    const spy = t.mock.method(ContactService.prototype, "sendContactMessage", async () => {});

    const req: any = {
      body: {
        website: "",
        name: "Jane",
        email: "jane@example.com",
        serviceType: "Other",
        company: "Acme",
        message: "This is a long enough message for validation.",
      },
      ip: "1.2.3.4",
    };
    const res = fakeRes();
    const next = t.mock.fn();

    await submitContactRequest(req, res, next);

    assert.equal(spy.mock.callCount(), 1);
    assert.equal(res.statusCode, 200);
  });

  test("freelancer application: website filled in -> success response, createApplication service never called", async (t) => {
    const spy = t.mock.method(
      freelancerApplicationService,
      "createApplication",
      async () => {
        throw new Error("should not be called");
      }
    );

    const req: any = { body: { website: "http://spam.example" }, files: {}, ip: "5.6.7.8" };
    const res = fakeRes();
    const next = t.mock.fn();

    const finalHandler = createApplication[createApplication.length - 1] as (
      req: any,
      res: any,
      next: any
    ) => Promise<void>;
    await finalHandler(req, res, next);

    assert.equal(spy.mock.callCount(), 0);
    assert.equal(res.statusCode, 201);
    assert.equal(next.mock.callCount(), 0);
  });
});
