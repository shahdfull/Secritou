import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "a".repeat(32);
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "b".repeat(32);
process.env.JWT_ISSUER = process.env.JWT_ISSUER ?? "secritou-api";
process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? "secritou-web";
process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";

const { authenticate } = await import("../src/middlewares/auth.middleware.js");

function makeReq(token?: string) {
  return {
    header(name: string) {
      return name === "authorization" && token ? `Bearer ${token}` : undefined;
    },
  };
}

test("authenticate accepts access tokens only", async () => {
  const token = jwt.sign(
    {
      id: "user-1",
      sub: "user-1",
      tokenType: "access",
      email: "admin@example.com",
      role: "ADMIN",
      companyId: "company-1",
      clientId: null,
    },
    process.env.JWT_ACCESS_SECRET!,
    {
      expiresIn: "15m",
      issuer: process.env.JWT_ISSUER!,
      audience: process.env.JWT_AUDIENCE!,
    },
  );

  const req = makeReq(token);
  let called = false;
  await authenticate(req as any, {} as any, (err?: unknown) => {
    assert.equal(err, undefined);
    called = true;
  });

  assert.equal(called, true);
  assert.equal((req as any).user.tokenType, "access");
});

test("authenticate rejects refresh tokens", async () => {
  const token = jwt.sign(
    {
      sub: "user-1",
      tokenType: "refresh",
    },
    process.env.JWT_REFRESH_SECRET!,
    {
      expiresIn: "7d",
      issuer: process.env.JWT_ISSUER!,
      audience: process.env.JWT_AUDIENCE!,
    },
  );

  const req = makeReq(token);
  let error: any;
  await authenticate(req as any, {} as any, (err?: unknown) => {
    error = err;
  });

  assert.equal(error?.statusCode, 401);
});
