import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";

// Set env before any service imports
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "a".repeat(32);
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "b".repeat(32);
process.env.JWT_ISSUER = process.env.JWT_ISSUER ?? "secritou-api";
process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? "secritou-web";
process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "admin@example.com",
    name: "Admin",
    passwordHash: bcrypt.hashSync("correct-password", 10),
    role: "ADMIN",
    companyId: "company-1",
    clientId: null,
    mustChangePassword: false,
    resetToken: null,
    resetTokenExpiry: null,
    ...overrides,
  };
}

type FakeDb = {
  _rt: Record<string, unknown> | null;
  _user: Record<string, unknown> | null;
  _updateManyArgs: unknown[];
  user: {
    findUnique: (a: unknown) => Promise<unknown>;
    findFirst: (a: unknown) => Promise<unknown>;
    update: (a: unknown) => Promise<unknown>;
  };
  refreshToken: {
    create: (a: unknown) => Promise<unknown>;
    findUnique: (a: unknown) => Promise<unknown>;
    update: (a: unknown) => Promise<unknown>;
    updateMany: (a: unknown) => Promise<unknown>;
    deleteMany: (a: unknown) => Promise<unknown>;
  };
  company: {
    create: (a: unknown) => Promise<unknown>;
  };
};

function makeDb(overrides: Partial<FakeDb> = {}): FakeDb {
  const db: FakeDb = {
    _rt: null,
    _user: null,
    _updateManyArgs: [],
    user: {
      findUnique: async () => db._user,
      findFirst: async () => db._user,
      update: async () => ({}),
    },
    refreshToken: {
      create: async () => ({}),
      findUnique: async () => db._rt,
      update: async () => ({}),
      updateMany: async (args) => { db._updateManyArgs.push(args); return {}; },
      deleteMany: async () => ({}),
    },
    company: {
      create: async () => ({ users: [makeUser()] }),
    },
    ...overrides,
  };
  return db;
}

const { AuthService } = await import("../src/services/auth.service.js");

// ── TEST 1: login() with valid credentials ──────────────────────────────────
test("login() with valid credentials returns tokens and user", async () => {
  const db = makeDb();
  db._user = makeUser();

  const svc = new AuthService(db as any);
  const result = await svc.login({ email: "admin@example.com", password: "correct-password" });

  assert.ok(result.tokens.accessToken, "should have accessToken");
  assert.ok(result.tokens.refreshToken, "should have refreshToken");
  assert.equal(result.user.email, "admin@example.com");
  assert.equal(result.user.role, "ADMIN");
  assert.ok(!("passwordHash" in result.user), "passwordHash must not be exposed");
});

// ── TEST 2: login() with wrong password throws 401 ─────────────────────────
test("login() with wrong password throws 401", async () => {
  const db = makeDb();
  db._user = makeUser();

  const svc = new AuthService(db as any);

  await assert.rejects(
    () => svc.login({ email: "admin@example.com", password: "wrong-password" }),
    (err: any) => {
      assert.equal(err.statusCode, 401);
      assert.equal(err.message, "Invalid email or password");
      return true;
    },
  );
});

// ── TEST 3: login() with unknown email throws 401 (no info leak) ────────────
test("login() with unknown email throws 401 (no info leak)", async () => {
  const db = makeDb();
  db._user = null;

  const svc = new AuthService(db as any);

  await assert.rejects(
    () => svc.login({ email: "nobody@example.com", password: "irrelevant" }),
    (err: any) => {
      assert.equal(err.statusCode, 401);
      assert.equal(err.message, "Invalid email or password");
      return true;
    },
  );
});

// ── TEST 4: refresh() with revoked token throws 401 and revokes family ──────
test("refresh() with revoked token throws 401 and revokes family", async () => {
  const db = makeDb();
  db._user = makeUser();

  const svc = new AuthService(db as any);
  const { tokens } = await svc.login({ email: "admin@example.com", password: "correct-password" });

  db._rt = {
    id: "rt-1",
    tokenHash: hashToken(tokens.refreshToken),
    userId: "user-1",
    familyId: "family-1",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    revokedAt: new Date(), // already revoked
    user: makeUser(),
  };
  db._updateManyArgs.length = 0;

  await assert.rejects(
    () => svc.refresh(tokens.refreshToken),
    (err: any) => {
      assert.equal(err.statusCode, 401);
      return true;
    },
  );

  assert.ok(
    db._updateManyArgs.some((a: any) => a?.where?.familyId === "family-1"),
    "should revoke the token family",
  );
});

// ── TEST 5: refresh() with expired token throws 401 and revokes family ──────
test("refresh() with expired token throws 401 and revokes family", async () => {
  const db = makeDb();
  db._user = makeUser();

  const svc = new AuthService(db as any);
  const { tokens } = await svc.login({ email: "admin@example.com", password: "correct-password" });

  db._rt = {
    id: "rt-2",
    tokenHash: hashToken(tokens.refreshToken),
    userId: "user-1",
    familyId: "family-2",
    expiresAt: new Date(Date.now() - 1000), // expired
    revokedAt: null,
    user: makeUser(),
  };
  db._updateManyArgs.length = 0;

  await assert.rejects(
    () => svc.refresh(tokens.refreshToken),
    (err: any) => {
      assert.equal(err.statusCode, 401);
      return true;
    },
  );

  assert.ok(
    db._updateManyArgs.some((a: any) => a?.where?.familyId === "family-2"),
    "should revoke the expired token family",
  );
});

// ── TEST 6: refresh() token reuse (not in DB) → 401 ───────────────────────
test("refresh() token reuse (not in DB) throws 401", async () => {
  const db = makeDb();
  db._user = makeUser();

  const svc = new AuthService(db as any);
  const { tokens } = await svc.login({ email: "admin@example.com", password: "correct-password" });

  // Token consumed (not found in DB) = reuse attempt
  db._rt = null;

  await assert.rejects(
    () => svc.refresh(tokens.refreshToken),
    (err: any) => {
      assert.equal(err.statusCode, 401);
      return true;
    },
  );
});

// ── TEST 7: requestPasswordReset() with unknown email does not throw ─────────
test("requestPasswordReset() with unknown email does not throw (no info leak)", async () => {
  const db = makeDb();
  db._user = null;

  const svc = new AuthService(db as any);

  await assert.doesNotReject(() => svc.requestPasswordReset("ghost@example.com"));
});
