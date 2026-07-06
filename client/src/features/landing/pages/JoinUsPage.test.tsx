import { describe, expect, test } from "vitest";
import { z } from "zod";
import { isValidTunisianPhone } from "@secritou/shared";

// JoinUsPage's phone field validation is defined inline in the component
// (schema depends on t()). We exercise the same rule in isolation here —
// mounting JoinUsPage would require mocking file uploads for every case,
// which the CV/portfolio required-file checks already need real File objects
// for (see FileUploadField.test.tsx and useFreelancerApplications.test.tsx
// for those paths).
const phoneSchema = z.string().trim().optional().refine(
  (value) => !value || isValidTunisianPhone(value),
  "invalid"
);

describe("JoinUsPage phone field schema (audit 03 #6)", () => {
  test("rejects a non-Tunisian-looking number", () => {
    expect(phoneSchema.safeParse("12345678").success).toBe(false);
  });

  test("accepts a valid +216 number", () => {
    expect(phoneSchema.safeParse("+21622123456").success).toBe(true);
  });

  test("accepts an empty value (optional field)", () => {
    expect(phoneSchema.safeParse("").success).toBe(true);
  });
});
