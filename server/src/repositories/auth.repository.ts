import type { ExtendedPrismaClient } from "../config/prisma.js";

const userPublicSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  companyId: true,
  clientId: true,
  mustChangePassword: true,
} as const;

export class AuthRepository {
  constructor(private readonly db: ExtendedPrismaClient | any) {}

  findUserByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } });
  }

  findUserById(id: string) {
    return this.db.user.findUnique({ where: { id } });
  }

  createCompanyWithOwner(input: { companyName: string; name: string; email: string; passwordHash: string }) {
    return this.db.company.create({
      data: {
        name: input.companyName,
        users: {
          create: {
            name: input.name,
            email: input.email,
            passwordHash: input.passwordHash,
            role: "ADMIN",
          },
        },
      },
      include: { users: { select: userPublicSelect } },
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
