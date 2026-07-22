// Manager Permission Service
import type { Prisma } from "@prisma/client";
import { managerPermissionRepository } from "../repositories/managerPermission.repository.js";
import { permissionProfileRepository } from "../repositories/permissionProfile.repository.js";
import { cacheGet, cacheSet, cacheDel } from "../cache/cacheService.js";
import { cacheKeys } from "../cache/cacheKeys.js";
import { HttpError } from "../utils/httpError.js";
import { auditLogService } from "./auditLog.service.js";

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

  async getDeleteImpact(id: string) {
    const managers = await managerPermissionRepository.findManagersByProfileId(id);
    return {
      managerCount: managers.length,
      managers,
    };
  },

  async create(data: { name: string; description?: string; permissions: Prisma.InputJsonValue; isDefault?: boolean }) {
    return permissionProfileRepository.create(data);
  },

  async update(id: string, data: Prisma.PermissionProfileUncheckedUpdateInput) {
    const updated = await permissionProfileRepository.update(id, data);
    const userIds = await managerPermissionRepository.findUserIdsByProfileId(id);
    await Promise.all(userIds.map((userId) => cacheDel(cacheKeys.managerPermissions(userId))));
    return updated;
  },

  async delete(id: string, options: { force?: boolean; actorId?: string; ipAddress?: string } = {}) {
    // SEC-114: the FK is ON DELETE SET NULL, so the delete itself never fails — but a Manager
    // still attached to this profile would silently lose every permission the profile granted
    // (resolvePermissions falls back to base = {}) the next time their cache entry expires or is
    // invalidated. Block by default, or allow force deletion with AuditLog.
    const managers = await managerPermissionRepository.findManagersByProfileId(id);
    if (managers.length > 0 && !options.force) {
      throw new HttpError(
        409,
        `Cannot delete a permission profile still assigned to ${managers.length} manager(s): ${managers.map((m) => m.userName).join(", ")}`,
        "PERMISSION_PROFILE_IN_USE"
      );
    }

    // Get the profile before deleting for AuditLog
    const profileBefore = await permissionProfileRepository.findById(id);
    if (!profileBefore) {
      throw new HttpError(404, "Permission profile not found", "NOT_FOUND");
    }

    // Delete the profile
    const deletedProfile = await permissionProfileRepository.delete(id);

    // Invalidate cache for affected managers
    if (managers.length > 0) {
      await Promise.all(managers.map((m) => cacheDel(cacheKeys.managerPermissions(m.userId))));
    }

    // Record AuditLog
    await auditLogService.record({
      actorId: options.actorId,
      action: "delete",
      entityType: "PermissionProfile",
      entityId: id,
      before: {
        ...profileBefore,
        attachedManagers: managers.map((m) => ({ userId: m.userId, userName: m.userName })),
      },
      after: {
        deleted: true,
        detachedManagers: managers.map((m) => ({ userId: m.userId, userName: m.userName })),
      },
      ipAddress: options.ipAddress,
    });

    return deletedProfile;
  },
};
