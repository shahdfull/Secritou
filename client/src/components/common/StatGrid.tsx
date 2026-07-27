import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export interface StatGridItem {
  /** Unique label, also used as the React key. */
  label: string;
  icon: LucideIcon;
  /** Rendered inside CardContent — a value, a value + trend, a skeleton, etc. */
  content: ReactNode;
}

interface StatGridProps {
  items: StatGridItem[];
  className?: string;
}

// Shared by DashboardPage's KPI row, its "see more" detail KPI row, and its
// trends row — all three previously duplicated the exact same
// Card/CardHeader/icon-badge markup with only the CardContent body differing.
export function StatGrid({ items, className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" }: StatGridProps) {
  return (
    <div className={className}>
      {items.map(({ label, icon: Icon, content }) => (
        <Card key={label} className="rounded-2xl border border-border shadow-none">
          <CardHeader className="flex flex-row items-start justify-between pb-3 pt-5 px-5">
            <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
              {label}
            </p>
            <div className="h-8 w-8 rounded-xl bg-primary-soft/40 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">{content}</CardContent>
        </Card>
      ))}
    </div>
  );
}