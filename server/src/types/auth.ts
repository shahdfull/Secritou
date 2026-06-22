import type { Role } from "@prisma/client";

export type JwtPayload = {
  id: string;
  sub: string;
  tokenType: "access" | "refresh";
  email: string;
  role: Role;
  clientId: string | null;
  mustChangePassword: boolean;
};

