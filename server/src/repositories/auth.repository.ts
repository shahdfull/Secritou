import type { ExtendedPrismaClient } from "../config/prisma.js";
import type { Role } from "@prisma/client";

const userPublicSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  clientId: true,
  mustChangePassword: true,
} as const;

export class AuthRepository {
  // Kept loosely typed until SEC-050 is resolved: tightening this to ExtendedPrismaClient makes
  // the compiler surface a real latent bug (userPublicSelect omits `phone`, which the auth-user
  // contract promises), and fixing that is a behavior change to decide, not a silent patch. This
  // is the one remaining lint warning, tracked by SEC-049/SEC-050 rather than suppressed.
  constructor(private readonly db: ExtendedPrismaClient | any) {}

  findUserByEmail(email: string) {
    return this.db.user.findFirst({ where: { email } });
  }

  findUserById(id: string) {
    return this.db.user.findUnique({ where: { id } });
  }

  createUser(input: { name: string; email: string; passwordHash: string; role?: Role }) {
    return this.db.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        role: input.role ?? "CLIENT",
      },
      select: userPublicSelect,
    });
  }

  createRefreshToken(input: { tokenHash: string; userId: string; familyId: string; expiresAt: Date }) {
    return this.db.refreshToken.create({ data: input });
  }

  findRefreshToken(tokenHash: string) {
    return this.db.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: userPublicSelect } },
    });
  }

  revokeRefreshToken(id: string) {
    return this.db.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  revokeTokenFamily(familyId: string) {
    return this.db.refreshToken.updateMany({
      where: { familyId },
      data: { revokedAt: new Date() },
    });
  }

  // Revokes every active refresh token for a user, across all token families — used when a
  // role change must invalidate any session that could still carry the old role's permissions.
  revokeAllSessionsForUser(userId: string) {
    return this.db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
