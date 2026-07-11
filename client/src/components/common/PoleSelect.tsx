import { useServices } from "@/hooks/useServices";
import { useAuthStore } from "@/store/auth.store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_POLES_VALUE = "__all__";

interface PoleSelectProps {
  value: string | undefined;
  onChange: (serviceId: string | undefined) => void;
}

// ADMIN-only filter — visible only for that role; a MANAGER is always scoped
// to their own pole server-side, so this dropdown would be misleading for them.
export function PoleSelect({ value, onChange }: PoleSelectProps) {
  const role = useAuthStore((s) => s.user?.role);
  const { data: services } = useServices();

  if (role !== "ADMIN") return null;

  return (
    <Select
      value={value ?? ALL_POLES_VALUE}
      onValueChange={(v) => onChange(v === ALL_POLES_VALUE ? undefined : v)}
    >
      <SelectTrigger className="w-[180px] h-8 text-xs">
        <SelectValue placeholder="Pôle" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_POLES_VALUE}>Tous les pôles</SelectItem>
        {(services ?? []).map((s) => (
          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
