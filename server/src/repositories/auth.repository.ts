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
}
