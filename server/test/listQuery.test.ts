import test from "node:test";
import assert from "node:assert/strict";
import { buildOrderBy, buildTextSearchFilter, parseListQuery } from "../src/utils/listQuery.js";

test("parseListQuery caps pageSize at 50", () => {
  const result = parseListQuery({ pageSize: "500" });
  assert.equal(result.pageSize, 50);
});

test("parseListQuery defaults page to 1", () => {
  const result = parseListQuery({});
  assert.equal(result.page, 1);
});

test("parseListQuery trims search and respects descending order", () => {
  const result = parseListQuery({
    page: "2",
    pageSize: "12",
    search: "  invoices  ",
    status: "  OPEN  ",
    orderBy: "createdAt",
    orderDir: "desc",
  });

  assert.equal(result.page, 2);
  assert.equal(result.pageSize, 12);
  assert.equal(result.search, "invoices");
  assert.equal(result.status, "OPEN");
  assert.equal(result.orderBy, "createdAt");
  assert.equal(result.orderDir, "desc");
});

test("buildOrderBy falls back to default field", () => {
  const result = buildOrderBy("unknown", "desc", ["createdAt", "name"], "createdAt");
  assert.deepEqual(result, { createdAt: "desc" });
});

test("buildTextSearchFilter returns empty object without search", () => {
  assert.deepEqual(buildTextSearchFilter(undefined, ["name"]), {});
});

test("buildTextSearchFilter builds insensitive OR clauses", () => {
  assert.deepEqual(buildTextSearchFilter("acme", ["name", "email"]), {
    OR: [
      { name: { contains: "acme", mode: "insensitive" } },
      { email: { contains: "acme", mode: "insensitive" } },
    ],
  });
});
