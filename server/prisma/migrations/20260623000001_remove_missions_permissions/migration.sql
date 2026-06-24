-- Migration: Remove 'missions' from ManagerPermission overrides and PermissionProfile permissions
-- The missions feature has been removed; clean up any stored permission data for that module.

-- Remove 'missions' key from ManagerPermission overrides (JSONB column)
UPDATE "ManagerPermission"
SET "overrides" = "overrides" - 'missions'
WHERE "overrides" ? 'missions';

-- Remove 'missions' key from PermissionProfile permissions (JSONB column)
UPDATE "PermissionProfile"
SET "permissions" = "permissions" - 'missions'
WHERE "permissions" ? 'missions';
