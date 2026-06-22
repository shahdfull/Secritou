// Manager Permission Service
import { managerPermissionRepository } from "../repositories/managerPermission.repository.js";
import { permissionProfileRepository } from "../repositories/permissionProfile.repository.js";
import { cacheService } from "../cache/cacheService.js";
import { cacheKeys } from "../cache/cacheKeys.js";

const MODULES = [
  "projects",
  "tasks",
  "missions",
  "freelancers",
  "clients",
  "leads",
  "invoices",
  "analytics",
  "approvals",
  "documents",
] as const;

const DEFAULT_MANAGER_PERMISSIONS = MODULES.reduce((acc, module) => {
  acc[module] = {
    read: false,
    create: false,
    update: false,
    delete: false,
  };
  return acc;
}, {} as any);

function deepMerge(base: any, overrides: any) {
  const result = { ...base };
  for (const key in overrides) {
    if (
      overrides[key] &&
      typeof overrides[key] === "object" &&
      !Array.isArray(overrides[key])
    ) {
      result[key] = deepMerge(result[key] || {}, overrides[key]);
    } else {
      result[key] = overrides[key];
    }
  }
  return result;
}

export const managerPermissionService = {
  async resolvePermissions(userId: string) {
    const cacheKey = cacheKeys.managerPermissions(userId);
    const cached = await cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const mp = await managerPermissionRepository.findByUserId(userId);
    if (!mp) {
      await cacheService.set(cacheKey, DEFAULT_MANAGER_PERMISSIONS, 300); // 5 minutes
      return DEFAULT_MANAGER_PERMISSIONS;
    }

    const base = mp.profile?.permissions || {};
    const overrides = mp.overrides || {};
    const resolved = deepMerge(base, overrides);

    await cacheService.set(cacheKey, resolved, 300);
    return resolved;
  },

  async invalidateCache(userId: string) {
    const cacheKey = cacheKeys.managerPermissions(userId);
    await cacheService.del(cacheKey);
  },

  async findByUserId(userId: string) {
    return managerPermissionRepository.findByUserId(userId);
  },

  async update(userId: string, data: any) {
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

  async create(data: any) {
    return permissionProfileRepository.create(data);
  },

  async update(id: string, data: any) {
    return permissionProfileRepository.update(id, data);
  },

  async delete(id: string) {
    return permissionProfileRepository.delete(id);
  },
};
