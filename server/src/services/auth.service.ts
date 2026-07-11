import { Prisma, type Role, type User } from "@prisma/client";
import logger from "../utils/logger.js";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { randomBytes, createHash } from "node:crypto";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { AuthRepository } from "../repositories/auth.repository.js";
import { enqueueEmail } from "../jobs/queues.js";
import { passwordResetTemplate } from "./emailTemplates/index.js";
import { HttpError } from "../utils/httpError.js";
import { parseDurationToDate } from "../utils/parseDuration.js";
import { COMPANY_ID } from "../config/constants.js";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function toAuthUser(
  user: Pick<User, "id" | "email" | "name" | "role" | "clientId" | "mustChangePassword">
) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    clientId: user.clientId,
    mustChangePassword: user.mustChangePassword,
  };
}

function signAccessToken(
  user: Pick<User, "id" | "email" | "role" | "clientId" | "mustChangePassword">
) {
  return jwt.sign(
    {
      id: user.id,
      sub: user.id,
      tokenType: "access" as const,
      email: user.email,
      role: user.role,
      clientId: user.clientId,
      mustChangePassword: user.mustChangePassword,
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    },
  );
}

function signRefreshToken(userId: string, familyId: string) {
  return jwt.sign({ sub: userId, tokenType: "refresh" as const, familyId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    jwtid: randomBytes(16).toString("hex"),
  });
}

export class AuthService {
  private readonly repo: AuthRepository;
  private readonly db: typeof prisma;

  constructor(db: typeof prisma = prisma) {
    this.db = db;
    this.repo = new AuthRepository(db);
  }

  async register(input: { email: string; password: string; name: string; role?: string }) {
    const existing = await this.repo.findUserByEmail(input.email);
    if (existing) throw new HttpError(409, "Email is already registered");

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.repo.createUser({
      email: input.email,
      name: input.name,
      passwordHash,
      // Hardcode role to CLIENT for public registration
      role: "CLIENT",
    });
    return this.issueTokens(user);
  }

  async login(input: { email: string; password: string }) {
    const user = await this.repo.findUserByEmail(input.email);
    if (!user) throw new HttpError(401, "Invalid email or password");

    const isValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValid) throw new HttpError(401, "Invalid email or password");

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string) {
    let decoded: jwt.JwtPayload & { tokenType?: string; jti?: string; familyId?: string };
    try {
      decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET, {
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
        algorithms: ["HS256"],
      }) as jwt.JwtPayload & { tokenType?: string; jti?: string; familyId?: string };

      if (decoded.tokenType !== "refresh" || typeof decoded.sub !== "string") {
        throw new Error("Invalid token type");
      }
    } catch {
      throw new HttpError(401, "Invalid refresh token");
    }

    const tokenHash = hashToken(refreshToken);
    const stored = await this.repo.findRefreshToken(tokenHash);

    if (!stored) {
      // Reuse detected - revoke entire family!
      if (decoded.familyId) {
        await this.repo.revokeTokenFamily(decoded.familyId);
      }
      throw new HttpError(401, "Refresh token is no longer valid");
    }

    if (stored.revokedAt || stored.expiresAt < new Date()) {
      // Token was revoked or expired
      await this.repo.revokeTokenFamily(stored.familyId);
      throw new HttpError(401, "Refresh token is no longer valid");
    }

    // Revoke old token and issue new one
    await this.repo.revokeRefreshToken(stored.id);
    return this.issueTokens(stored.user, stored.familyId);
  }

  async me(userId: string) {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new HttpError(404, "User not found");
    return toAuthUser(user);
  }

  async logout(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.repo.findRefreshToken(tokenHash);
    if (stored) {
      await this.repo.revokeTokenFamily(stored.familyId);
    }
  }

  async requestPasswordReset(email: string) {
    const user = await this.repo.findUserByEmail(email);
    if (!user) return;

    const resetToken = randomBytes(32).toString("hex");
    const resetTokenHash = hashToken(resetToken);
    const resetTokenExpiry = new Date(Date.now() + 1000 * 60 * 60);

    await this.db.user.update({
      where: { id: user.id },
      data: { resetToken: resetTokenHash, resetTokenExpiry },
    });

    try {
      const { subject, html } = passwordResetTemplate(
        user.name,
        `${env.FRONTEND_URL}/reset-password?token=${resetToken}`
      );
      void enqueueEmail({ to: user.email, subject, html });
    } catch (error) {
      logger.error({ err: error }, "[auth] Failed to enqueue password reset email");
      // Non-fatal : le token est déjà persisté en base
    }
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = hashToken(token);
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Serializable isolation ensures that two concurrent calls with the same token
    // cannot both pass the findFirst check — one will succeed and the other will
    // receive a serialization error (retried by the caller or surfaced as 400).
    await this.db.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { resetToken: tokenHash, resetTokenExpiry: { gt: new Date() } },
        select: { id: true },
      });
      if (!user) throw new HttpError(400, "Invalid or expired reset token");

      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash, resetToken: null, resetTokenExpiry: null, mustChangePassword: false },
      });
      await tx.refreshToken.deleteMany({ where: { userId: user.id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new HttpError(404, "User not found");

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) throw new HttpError(401, "Invalid current password");

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.db.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });
    await this.db.refreshToken.deleteMany({ where: { userId: user.id } });
  }

  private async issueTokens(
    user: Pick<User, "id" | "email" | "name" | "role" | "clientId" | "mustChangePassword">,
    existingFamilyId?: string
  ) {
    const familyId = existingFamilyId || randomBytes(16).toString("hex");
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user.id, familyId);

    await this.repo.createRefreshToken({
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      familyId,
      expiresAt: parseDurationToDate(env.JWT_REFRESH_EXPIRES_IN),
    });

    return {
      user: toAuthUser(user),
      tokens: { accessToken, refreshToken },
    };
  }
}
