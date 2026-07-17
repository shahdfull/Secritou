// SEC-001 (ANOMALIES.yaml): BRIEF_QUESTIONS used to be keyed on stale pre-migration English
// pole names ("Technology Solutions", "Digital Growth", "AI & Automation", "Business
// Performance"), which never matched any real Service.name after migration
// 20260711210000_fix_service_name_locale_drift renamed Service rows to the 4 canonical FR
// names — getBriefQuestions() silently fell back to the "Technologie" questionnaire for
// every project outside that one pole (a warning was logged, but nothing user-visible
// changed). This test imports and calls the real function for all 4 canonical poles, not a
// reimplementation of the lookup — it would go red again if the keys ever drift back out of
// sync with prisma/seed.ts's canonical names.

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { getBriefQuestions, BRIEF_QUESTIONS } from "../src/constants/briefQuestions.js";

const CANONICAL_POLES = [
  "Management & Performance",
  "Croissance digitale",
  "Technologie",
  "IA & Automatisation",
] as const;

describe("getBriefQuestions — 4 canonical poles (SEC-001)", () => {
  for (const pole of CANONICAL_POLES) {
    test(`"${pole}" resolves to its own dedicated question set, not the Technologie fallback`, () => {
      const questions = getBriefQuestions(pole);
      assert.ok(questions.length > 0, `${pole} must return a non-empty question set`);
      assert.deepEqual(
        questions,
        BRIEF_QUESTIONS[pole],
        `getBriefQuestions("${pole}") must return exactly BRIEF_QUESTIONS["${pole}"], not a fallback`
      );
    });
  }

  test("the 4 canonical poles resolve to 4 genuinely different question sets", () => {
    const sets = CANONICAL_POLES.map((pole) => getBriefQuestions(pole));
    const keySets = sets.map((qs) => qs.map((q) => q.key).join(","));
    const uniqueKeySets = new Set(keySets);
    assert.equal(
      uniqueKeySets.size,
      CANONICAL_POLES.length,
      "each pole must have a distinct question set — if two poles silently share the same fallback, this catches it"
    );
  });

  test("an unmapped pole name falls back to the Technologie questionnaire", () => {
    const questions = getBriefQuestions("Some Unknown Pole");
    assert.deepEqual(questions, BRIEF_QUESTIONS["Technologie"]);
  });

  test("a null/undefined service name falls back to the Technologie questionnaire", () => {
    assert.deepEqual(getBriefQuestions(null), BRIEF_QUESTIONS["Technologie"]);
    assert.deepEqual(getBriefQuestions(undefined), BRIEF_QUESTIONS["Technologie"]);
  });

  test("the stale pre-migration English pole names no longer resolve to anything (regression guard)", () => {
    for (const stale of ["Technology Solutions", "Digital Growth", "AI & Automation", "Business Performance"]) {
      const questions = getBriefQuestions(stale);
      // They must now fall through to the same Technologie fallback as any other unmapped
      // string — not because they're specially recognized, but because they're not real keys.
      assert.deepEqual(questions, BRIEF_QUESTIONS["Technologie"], `"${stale}" must not be a live key in BRIEF_QUESTIONS anymore`);
    }
  });
});
