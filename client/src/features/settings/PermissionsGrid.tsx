import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PermissionsMap } from "@/types/permissions";
import { MODULES } from "@/types/permissions";

const ACTION_KEYS = ["read", "create", "update", "delete"] as const;

/**
 * A module × action checkbox grid. Shared by the profile editor (defines a
 * profile's own permissions) and the per-manager overrides panel (which
 * additionally marks cells that diverge from the manager's assigned
 * profile) — same visual grammar in both places so an admin only has to
 * learn it once.
 */
export function PermissionsGrid({
  value,
  onToggle,
  isCustomized,
}: {
  value: Partial<PermissionsMap>;
  onToggle: (mod: (typeof MODULES)[number], action: (typeof ACTION_KEYS)[number]) => void;
  /** Optional: mark a cell as differing from some baseline (e.g. the manager's profile). */
  isCustomized?: (mod: (typeof MODULES)[number], action: (typeof ACTION_KEYS)[number]) => boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="overflow-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-36">Module</TableHead>
            {ACTION_KEYS.map((k) => (
              <TableHead key={k} className="text-center w-24">{t(`permissions.actions.${k}`)}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {MODULES.map((mod) => {
            const modValue = value[mod] ?? { read: false, create: false, update: false, delete: false };
            return (
              <TableRow key={mod}>
                <TableCell className="font-medium text-sm">{t(`permissions.modules.${mod}`, mod)}</TableCell>
                {ACTION_KEYS.map((action) => {
                  const checked = !!(modValue as Record<string, boolean>)[action];
                  const customized = isCustomized?.(mod, action);
                  return (
                    <TableCell key={action} className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Checkbox checked={checked} onCheckedChange={() => onToggle(mod, action)} />
                        {customized && (
                          <span className="text-[10px] font-medium text-amber-600">modifié</span>
                        )}
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
