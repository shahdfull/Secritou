import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../src/utils/httpError.js";
import {
  assertFileSizeLimits,
  CV_MAX_BYTES,
  PORTFOLIO_MAX_BYTES,
} from "../src/controllers/freelancerApplication.controller.js";

describe("freelancerApplication upload size limits (audit 03 #4)", () => {
  test("an 11MB CV is rejected with CV_TOO_LARGE (413)", () => {
    const cvFile = { size: 11 * 1024 * 1024 };
    const portfolioFile = { size: 1024 };

    assert.throws(
      () => assertFileSizeLimits(cvFile, portfolioFile),
      (error: unknown) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.statusCode, 413);
        assert.equal(error.code, "CV_TOO_LARGE");
        return true;
      }
    );
  });

  test("a 15MB portfolio (within the 20MB portfolio limit) is accepted", () => {
    const cvFile = { size: 1024 };
    const portfolioFile = { size: 15 * 1024 * 1024 };

    assert.doesNotThrow(() => assertFileSizeLimits(cvFile, portfolioFile));
  });

  test("a 21MB portfolio is rejected with PORTFOLIO_TOO_LARGE (413)", () => {
    const cvFile = { size: 1024 };
    const portfolioFile = { size: 21 * 1024 * 1024 };

    assert.throws(
      () => assertFileSizeLimits(cvFile, portfolioFile),
      (error: unknown) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.statusCode, 413);
        assert.equal(error.code, "PORTFOLIO_TOO_LARGE");
        return true;
      }
    );
  });

  test("files exactly at the limit are accepted", () => {
    assert.doesNotThrow(() =>
      assertFileSizeLimits({ size: CV_MAX_BYTES }, { size: PORTFOLIO_MAX_BYTES })
    );
  });
});
