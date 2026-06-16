import type { Role, User } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { createHash } from "node:crypto";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { AuthRepository } from "../repositories/auth.repository.js";
import { HttpError } from "../utils/httpError.js";

const authRepository = new AuthRepository(prisma);

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function toAuthUser(user: Pick<User, "id" | "email" | "name" | "role" | "companyId" | "clientId">) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: user.companyId,
    clientId: user.clientId,
  };
}

function signAccessToken(user: Pick<User, "id" | "email" | "role" | "companyId" | "clientId">) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, companyId: user.companyId, clientId: user.clientId },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"] },
  );
}

function signRefreshToken(userId: string) {
  return jwt.sign({ sub: userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
  });
}

function refreshExpiryDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date;
}

export class AuthService {
  async register(input: { email: string; password: string; name: string; companyName: string }) {
    const existing = await authRepository.findUserByEmail(input.email);
    if (existing) throw new HttpError(409, "Email is already registered");

    const passwordHash = await bcrypt.hash(input.password, 12);
    const company = await authRepository.createCompanyWithOwner({
      companyName: input.companyName,
      email: input.email,
      name: input.name,
      passwordHash,
    });
    const user = company.users[0];
    return this.issueTokens(user);
  }

  async login(input: { email: string; password: string }) {
    const user = await authRepository.findUserByEmail(input.email);
    if (!user) throw new HttpError(401, "Invalid email or password");

    const isValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValid) throw new HttpError(401, "Invalid email or password");

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string) {
    try {
      jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    } catch {
      throw new HttpError(401, "Invalid refresh token");
    }

    const stored = await authRepository.findRefreshToken(hashToken(refreshToken));
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new HttpError(401, "Refresh token is no longer valid");
    }

    await authRepository.revokeRefreshToken(stored.id);
    return this.issueTokens(stored.user);
  }

  async me(userId: string) {
    const user = await authRepository.findUserById(userId);
    if (!user) throw new HttpError(404, "User not found");
    return toAuthUser(user);
  }

  async logout(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    const stored = await authRepository.findRefreshToken(tokenHash);
    if (stored) {
      await authRepository.revokeRefreshToken(stored.id);
    }
  }

  private async issueTokens(user: Pick<User, "id" | "email" | "name" | "role" | "companyId">) {
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user.id);
    await authRepository.createRefreshToken({
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      expiresAt: refreshExpiryDate(),
    });

    return {
      user: toAuthUser({ ...user, role: user.role as Role }),
      tokens: { accessToken, refreshToken },
    };
  }
}
