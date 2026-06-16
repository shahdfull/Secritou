import type { PrismaClient } from "@prisma/client";

export class AuthRepository {
  constructor(private readonly db: PrismaClient) {}

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
      include: { users: true },
    });
  }

  createRefreshToken(input: { tokenHash: string; userId: string; expiresAt: Date }) {
    return this.db.refreshToken.create({ data: input });
  }

  findRefreshToken(tokenHash: string) {
    return this.db.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
  }

  revokeRefreshToken(id: string) {
    return this.db.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
  }
}
