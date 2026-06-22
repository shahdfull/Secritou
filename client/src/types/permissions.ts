export const MODULES = [
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

export type Module = (typeof MODULES)[number];

export type Actions = {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
};

export type PermissionsMap = Record<Module, Actions>;

export interface PermissionProfile {
  id: string;
  name: string;
  description?: string;
  permissions: PermissionsMap;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ManagerPermission {
  id: string;
  userId: string;
  profileId?: string;
  profile?: PermissionProfile;
  overrides?: Partial<PermissionsMap>;
  createdAt: string;
  updatedAt: string;
}
