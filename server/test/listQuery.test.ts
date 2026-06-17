import test from "node:test";
import assert from "node:assert/strict";
import { parseListQuery } from "../src/utils/listQuery.js";

test("parseListQuery caps pageSize at 50", () => {
  const result = parseListQuery({ pageSize: "500" });
  assert.equal(result.pageSize, 50);
});

test("parseListQuery defaults page to 1", () => {
  const result = parseListQuery({});
  assert.equal(result.page, 1);
});
