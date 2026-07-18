// Manager Permission Service
import type { Prisma } from "@prisma/client";
import { managerPermissionRepository } from "../repositories/managerPermission.repository.js";
import { permissionProfileRepository } from "../repositories/permissionProfile.repository.js";
import { cacheGet, cacheSet, cacheDel } from "../cache/cacheService.js";
import { cacheKeys } from "../cache/cacheKeys.js";

// The permission matrix stored as JSON: per-module CRUD flags. Kept structurally typed (a plain
// record) rather than a Prisma type because it is serialized to/from a Json column.
type PermissionActions = { read: boolean; create: boolean; update: boolean; delete: boolean };
type PermissionMatrix = Record<string, PermissionActions>;

const MODULES = [
  "projects",
  "tasks",
  "freelancers",
  "clients",
  "leads",
  "invoices",
  "analytics",
  "approvals",
  "documents",
  "proposals",
  "service-requests",
  "client-success",
  "client-onboarding",
] as const;

const DEFAULT_MANAGER_PERMISSIONS: PermissionMatrix = MODULES.reduce((acc, module) => {
  acc[module] = {
    read: false,
    create: false,
    update: false,
    delete: false,
  };
  return acc;
}, {} as PermissionMatrix);

function deepMerge(base: Record<string, unknown>, overrides: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const key in overrides) {
    const value = overrides[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = deepMerge((result[key] as Record<string, unknown>) || {}, value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export const managerPermissionService = {
  // The stored JSON is a partial matrix (a profile/override may define only some modules or
  // actions), so callers always index it with optional chaining. Typed as PermissionMatrix for
  // that access shape; missing keys read as undefined at runtime, which the guards handle.
  async resolvePermissions(userId: string): Promise<PermissionMatrix> {
    const cacheKey = cacheKeys.managerPermissions(userId);
    const cached = await cacheGet<PermissionMatrix>(cacheKey);
    if (cached) return cached;

    const mp = await managerPermissionRepository.findByUserId(userId);
    if (!mp) {
      await cacheSet(cacheKey, DEFAULT_MANAGER_PERMISSIONS, 300); // 5 minutes
      return DEFAULT_MANAGER_PERMISSIONS;
    }

    let base: Record<string, unknown> = {};
    if (mp.profileId) {
      const profile = await permissionProfileRepository.findById(mp.profileId);
      base = (profile?.permissions as Record<string, unknown>) || {};
    }
    const overrides = (mp.overrides as Record<string, unknown>) || {};
    const resolved = deepMerge(base, overrides) as PermissionMatrix;

    await cacheSet(cacheKey, resolved, 300);
    return resolved;
  },

  async invalidateCache(userId: string) {
    const cacheKey = cacheKeys.managerPermissions(userId);
    await cacheDel(cacheKey);
  },

  async findByUserId(userId: string) {
    return managerPermissionRepository.findByUserId(userId);
  },

  async update(userId: string, data: Prisma.ManagerPermissionUncheckedUpdateInput) {
    const result = await managerPermissionRepository.update(userId, data);
    await this.invalidateCache(userId);
    return result;
  },
};

export const permissionProfileService = {
  async findAll() {
    return permissionProfileRepository.findAll();
  },

  async findById(id: string) {
    return permissionProfileRepository.findById(id);
  },

  async create(data: { name: string; description?: string; permissions: Prisma.InputJsonValue; isDefault?: boolean }) {
    return permissionProfileRepository.create(data);
  },

  async update(id: string, data: Prisma.PermissionProfileUncheckedUpdateInput) {
    return permissionProfileRepository.update(id, data);
  },

  async delete(id: string) {
    return permissionProfileRepository.delete(id);
  },
};
