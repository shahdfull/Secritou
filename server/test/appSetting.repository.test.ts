import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { isMissingAppSettingTableError } from "../src/repositories/appSetting.repository.js";

describe("appSettingRepository helpers", () => {
  test("detects the missing AppSetting table Prisma error", () => {
    const err = new Prisma.PrismaClientKnownRequestError("Table not found", {
      code: "P2021",
      clientVersion: "test",
    });

    assert.equal(isMissingAppSettingTableError(err), true);
    assert.equal(isMissingAppSettingTableError(new Error("nope")), false);
  });
});
