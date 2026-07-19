// Pure logic, no DB. Mirrors extractMentionedUserIds in utils/mentions.ts.
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { extractMentionedUserIds } from "../src/utils/mentions.js";

describe("extractMentionedUserIds", () => {
  test("extracts a single mention's userId, ignoring the display name", () => {
    const ids = extractMentionedUserIds("Salut @[Jean Dupont](11111111-1111-1111-1111-111111111111), tu peux regarder ?");
    assert.deepEqual(ids, ["11111111-1111-1111-1111-111111111111"]);
  });

  test("extracts multiple distinct mentions", () => {
    const ids = extractMentionedUserIds(
      "@[A](11111111-1111-1111-1111-111111111111) et @[B](22222222-2222-2222-2222-222222222222) doivent voir ça"
    );
    assert.deepEqual(ids.sort(), [
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222",
    ]);
  });

  test("deduplicates the same userId mentioned twice", () => {
    const ids = extractMentionedUserIds(
      "@[A](11111111-1111-1111-1111-111111111111) ... encore @[A](11111111-1111-1111-1111-111111111111)"
    );
    assert.deepEqual(ids, ["11111111-1111-1111-1111-111111111111"]);
  });

  test("returns an empty array when there is no mention", () => {
    assert.deepEqual(extractMentionedUserIds("Un commentaire tout à fait normal."), []);
  });

  test("ignores a bare @Name with no id payload (not the expected syntax)", () => {
    assert.deepEqual(extractMentionedUserIds("Salut @JeanDupont, regarde ça"), []);
  });
});
