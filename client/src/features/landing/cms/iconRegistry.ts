import {
  BarChart3,
  Rocket,
  Monitor,
  Sparkles,
  Building2,
  Compass,
  Store,
  EyeOff,
  Workflow,
  Globe2,
  Hourglass,
  LineChart,
  Users,
  TrendingUp,
  Zap,
  Target,
  type LucideIcon,
} from "lucide-react";

/**
 * Whitelist mapping a stored icon name (string, editable by admins via the
 * SiteContent CMS) back to the actual Lucide component. An admin picks from
 * this fixed set — never an arbitrary icon — so a typo or unknown value just
 * renders nothing instead of crashing or letting arbitrary code/assets in.
 * Keep names stable once used in stored content: renaming a key here blanks
 * the icon on existing rows instead of erroring.
 */
export const ICON_REGISTRY = {
  "bar-chart": BarChart3,
  rocket: Rocket,
  monitor: Monitor,
  sparkles: Sparkles,
  building: Building2,
  compass: Compass,
  store: Store,
  "eye-off": EyeOff,
  workflow: Workflow,
  globe: Globe2,
  hourglass: Hourglass,
  "line-chart": LineChart,
  users: Users,
  "trending-up": TrendingUp,
  zap: Zap,
  target: Target,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICON_REGISTRY;

export function resolveIcon(name: string): LucideIcon | null {
  return ICON_REGISTRY[name as IconName] ?? null;
}
