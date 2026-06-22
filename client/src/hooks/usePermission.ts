import { useAuthStore } from "../store/auth.store";
import type { Module } from "../types/permissions";

export function usePermission(
  module: Module,
  action: keyof { read: boolean; create: boolean; update: boolean; delete: boolean }
): boolean {
  const user = useAuthStore((state) => state.user);
  const can = useAuthStore((state) => state.can);

  if (user?.role === "ADMIN") return true;
  if (user?.role !== "MANAGER") return false;

  return can(module, action);
}
