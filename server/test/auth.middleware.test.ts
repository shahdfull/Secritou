import test from "node:test";
import { mock } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import type { HttpError } from "../src/utils/httpError.js";

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "a".repeat(32);
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "b".repeat(32);
process.env.JWT_ISSUER = process.env.JWT_ISSUER ?? "secritou-api";
process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? "secritou-web";
process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/secritou?schema=public";

const { authenticate } = await import("../src/middlewares/auth.middleware.js");
const { authDenylist } = await import("../src/cache/authDenylist.js");

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
  await authenticate(req as unknown as Request, {} as Response, (err?: unknown) => {
    assert.equal(err, undefined);
    called = true;
  });

  assert.equal(called, true);
  assert.equal((req as unknown as Request).user!.tokenType, "access");
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
  let error: HttpError | undefined;
  await authenticate(req as unknown as Request, {} as Response, (err?: unknown) => {
    error = err as HttpError | undefined;
  });

  assert.equal(error?.statusCode, 401);
});

test("authenticate rejects missing tokens", async () => {
  const req = makeReq();
  let error: HttpError | undefined;
  await authenticate(req as unknown as Request, {} as Response, (err?: unknown) => {
    error = err as HttpError | undefined;
  });

  assert.equal(error?.statusCode, 401);
});

test("authenticate rejects malformed tokens", async () => {
  const req = makeReq("not-a-token");
  let error: HttpError | undefined;
  await authenticate(req as unknown as Request, {} as Response, (err?: unknown) => {
    error = err as HttpError | undefined;
  });

  assert.equal(error?.statusCode, 401);
});

test("authenticate rejects a revoked access token before expiration", async () => {
  const revokeMock = mock.method(authDenylist, "isAccessTokenRevoked", async () => true);
  const token = jwt.sign(
    {
      id: "user-1",
      sub: "user-1",
      tokenType: "access",
      email: "admin@example.com",
      role: "ADMIN",
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
  let error: HttpError | undefined;
  await authenticate(req as unknown as Request, {} as Response, (err?: unknown) => {
    error = err as HttpError | undefined;
  });

  assert.equal(error?.statusCode, 401);
  assert.equal(revokeMock.mock.callCount(), 1);
});
