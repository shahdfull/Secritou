import type { Role } from "@prisma/client";

export type JwtPayload = {
  sub: string;
  email: string;
  role: Role;
  companyId: string | null;
};
