import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { isValidTunisianPhone } from "./phone.js";

describe("isValidTunisianPhone (audit 03 #6)", () => {
  test("accepts +216 followed by 8 digits starting 2-9", () => {
    assert.ok(isValidTunisianPhone("+21622123456"));
  });

  test("accepts a bare 8-digit local number starting 2-9", () => {
    assert.ok(isValidTunisianPhone("22123456"));
  });

  test("rejects a bare number starting with 1 (only 2-9 are valid leading digits)", () => {
    assert.ok(!isValidTunisianPhone("12345678"));
  });

  test("rejects non-numeric input", () => {
    assert.ok(!isValidTunisianPhone("abc"));
  });

  test("accepts an empty string (phone is optional)", () => {
    assert.ok(isValidTunisianPhone(""));
  });

  test("accepts +216 with spaces, normalized before matching", () => {
    assert.ok(isValidTunisianPhone("+21622 123 456"));
  });

  test("rejects '216...' without the leading + (ambiguous with a local number)", () => {
    assert.ok(!isValidTunisianPhone("21622123456"));
  });
});
