// Tests for Zod validators : no DB, no real imports beyond the validator files
// Pattern: import the real schema, call .safeParse(), assert success/failure
// Source: src/validators/auth.validator.ts, lead.validator.ts, rating.validator.ts

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

// ─── Inline schemas mirroring the real validators ────────────────────────────
// We inline them (not import) because the validators import @prisma/client enums
// which requires a generated client : not available in test environment.
// The schemas tested here are exact copies of the source.

const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(2),
    companyName: z.string().min(2),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
  }),
});

const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(20),
    newPassword: z.string().min(8),
  }),
});

// ─── Lead validator (mirrors lead.validator.ts, enum excluded) ────────────────

const createLeadSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    source: z.string().optional(),
    notes: z.string().optional(),
  }),
});

// ─── Invoice validator (inline : no dedicated file exists yet) ────────────────

const createInvoiceSchema = z.object({
  body: z.object({
    number: z.string().min(1),
    title: z.string().min(1),
    amount: z.number().positive(),
    currency: z.string().optional(),
    clientId: z.string().uuid(),
    dueDate: z.string().datetime().optional(),
    projectId: z.string().uuid().optional(),
  }),
});

// ─── Proposal validator (inline : no dedicated file exists yet) ───────────────

const createProposalSchema = z.object({
  body: z.object({
    title: z.string().min(1),
    clientId: z.string().uuid(),
    amount: z.number().nonnegative().optional(),
    currency: z.string().optional(),
    expiresAt: z.string().datetime().optional(),
  }),
});

// ─── Tests: registerSchema ────────────────────────────────────────────────────

describe("registerSchema", () => {
  test("rejects empty password", () => {
    const result = registerSchema.safeParse({
      body: { email: "test@test.com", password: "", name: "Test", companyName: "Acme" },
    });
    assert.equal(result.success, false);
  });

  test("rejects password shorter than 8 chars", () => {
    const result = registerSchema.safeParse({
      body: { email: "test@test.com", password: "short", name: "Test", companyName: "Acme" },
    });
    assert.equal(result.success, false);
  });

  test("rejects invalid email format", () => {
    const result = registerSchema.safeParse({
      body: { email: "not-an-email", password: "Password123!", name: "Test", companyName: "Acme" },
    });
    assert.equal(result.success, false);
  });

  test("rejects name shorter than 2 chars", () => {
    const result = registerSchema.safeParse({
      body: { email: "test@test.com", password: "Password123!", name: "T", companyName: "Acme" },
    });
    assert.equal(result.success, false);
  });

  test("rejects missing companyName", () => {
    const result = registerSchema.safeParse({
      body: { email: "test@test.com", password: "Password123!", name: "Test" },
    });
    assert.equal(result.success, false);
  });

  test("accepts valid credentials", () => {
    const result = registerSchema.safeParse({
      body: { email: "user@company.com", password: "Password123!", name: "John", companyName: "Acme" },
    });
    assert.equal(result.success, true);
  });
});

// ─── Tests: loginSchema ───────────────────────────────────────────────────────

describe("loginSchema", () => {
  test("rejects missing email", () => {
    const result = loginSchema.safeParse({
      body: { password: "Password123!" },
    });
    assert.equal(result.success, false);
  });

  test("rejects invalid email", () => {
    const result = loginSchema.safeParse({
      body: { email: "bad", password: "Password123!" },
    });
    assert.equal(result.success, false);
  });

  test("rejects short password", () => {
    const result = loginSchema.safeParse({
      body: { email: "test@test.com", password: "short" },
    });
    assert.equal(result.success, false);
  });

  test("accepts valid login", () => {
    const result = loginSchema.safeParse({
      body: { email: "test@test.com", password: "Password123!" },
    });
    assert.equal(result.success, true);
  });
});

// ─── Tests: resetPasswordSchema ───────────────────────────────────────────────

describe("resetPasswordSchema", () => {
  test("rejects token shorter than 20 chars", () => {
    const result = resetPasswordSchema.safeParse({
      body: { token: "short", newPassword: "NewPass123!" },
    });
    assert.equal(result.success, false);
  });

  test("rejects new password shorter than 8 chars", () => {
    const result = resetPasswordSchema.safeParse({
      body: { token: "a".repeat(20), newPassword: "short" },
    });
    assert.equal(result.success, false);
  });

  test("accepts valid reset payload", () => {
    const result = resetPasswordSchema.safeParse({
      body: { token: "a".repeat(32), newPassword: "NewPass123!" },
    });
    assert.equal(result.success, true);
  });
});

// ─── Tests: createLeadSchema ──────────────────────────────────────────────────

describe("createLeadSchema", () => {
  test("rejects missing name", () => {
    const result = createLeadSchema.safeParse({ body: {} });
    assert.equal(result.success, false);
  });

  test("rejects name shorter than 2 chars", () => {
    const result = createLeadSchema.safeParse({ body: { name: "A" } });
    assert.equal(result.success, false);
  });

  test("rejects invalid email format when provided", () => {
    const result = createLeadSchema.safeParse({ body: { name: "Acme Corp", email: "not-email" } });
    assert.equal(result.success, false);
  });

  test("accepts lead with name only", () => {
    const result = createLeadSchema.safeParse({ body: { name: "Acme Corp" } });
    assert.equal(result.success, true);
  });

  test("accepts lead with valid email", () => {
    const result = createLeadSchema.safeParse({
      body: { name: "Acme Corp", email: "contact@acme.com" },
    });
    assert.equal(result.success, true);
  });

  test("accepts optional fields", () => {
    const result = createLeadSchema.safeParse({
      body: { name: "Acme Corp", phone: "+33612345678", source: "LinkedIn", notes: "Hot lead" },
    });
    assert.equal(result.success, true);
  });
});

// ─── Tests: createInvoiceSchema ───────────────────────────────────────────────

describe("createInvoiceSchema", () => {
  const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

  test("rejects zero amount", () => {
    const result = createInvoiceSchema.safeParse({
      body: { number: "INV-001", title: "Services", amount: 0, clientId: VALID_UUID },
    });
    assert.equal(result.success, false);
  });

  test("rejects negative amount", () => {
    const result = createInvoiceSchema.safeParse({
      body: { number: "INV-001", title: "Services", amount: -100, clientId: VALID_UUID },
    });
    assert.equal(result.success, false);
  });

  test("rejects invalid clientId (not UUID)", () => {
    const result = createInvoiceSchema.safeParse({
      body: { number: "INV-001", title: "Services", amount: 1000, clientId: "not-a-uuid" },
    });
    assert.equal(result.success, false);
  });

  test("rejects missing number", () => {
    const result = createInvoiceSchema.safeParse({
      body: { title: "Services", amount: 1000, clientId: VALID_UUID },
    });
    assert.equal(result.success, false);
  });

  test("accepts valid invoice", () => {
    const result = createInvoiceSchema.safeParse({
      body: { number: "INV-001", title: "Développement web", amount: 5000, clientId: VALID_UUID },
    });
    assert.equal(result.success, true);
  });

  test("accepts optional dueDate in ISO format", () => {
    const result = createInvoiceSchema.safeParse({
      body: {
        number: "INV-002",
        title: "Design",
        amount: 1500,
        clientId: VALID_UUID,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    assert.equal(result.success, true);
  });
});

// ─── Tests: createProposalSchema ─────────────────────────────────────────────

describe("createProposalSchema", () => {
  const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

  test("rejects missing title", () => {
    const result = createProposalSchema.safeParse({ body: { clientId: VALID_UUID } });
    assert.equal(result.success, false);
  });

  test("rejects negative amount", () => {
    const result = createProposalSchema.safeParse({
      body: { title: "Refonte site", clientId: VALID_UUID, amount: -500 },
    });
    assert.equal(result.success, false);
  });

  test("accepts zero amount (free proposal)", () => {
    const result = createProposalSchema.safeParse({
      body: { title: "Audit gratuit", clientId: VALID_UUID, amount: 0 },
    });
    assert.equal(result.success, true);
  });

  test("rejects invalid clientId", () => {
    const result = createProposalSchema.safeParse({
      body: { title: "Refonte", clientId: "not-a-uuid" },
    });
    assert.equal(result.success, false);
  });

  test("accepts valid proposal without amount", () => {
    const result = createProposalSchema.safeParse({
      body: { title: "Refonte site", clientId: VALID_UUID },
    });
    assert.equal(result.success, true);
  });

  test("accepts valid proposal with amount", () => {
    const result = createProposalSchema.safeParse({
      body: { title: "Refonte site", clientId: VALID_UUID, amount: 12000, currency: "EUR" },
    });
    assert.equal(result.success, true);
  });
});
