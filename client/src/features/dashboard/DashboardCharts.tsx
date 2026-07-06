import { memo, useMemo } from "react";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { LEAD_STATUS_LABELS, LEAD_STATUS_CHART_COLOR } from "@/utils/statusColors";

type LeadsByMonthItem = { month: string; count: number };
type LeadByStatusItem = { status: string; count: number };
export interface DashboardChartsProps {
  leadsByMonth: LeadsByMonthItem[];
  leadsByStatus: LeadByStatusItem[];
}

const STATUS_LABELS = LEAD_STATUS_LABELS;
const STATUS_COLORS = LEAD_STATUS_CHART_COLOR;

export const DashboardCharts = memo(function DashboardCharts({
  leadsByMonth,
  leadsByStatus,
}: DashboardChartsProps) {
  const { t } = useTranslation();

  const total = useMemo(
    () => leadsByStatus.reduce((s, d) => s + d.count, 0),
    [leadsByStatus]
  );

  const donutData = useMemo(
    () =>
      leadsByStatus.map((d) => ({
        ...d,
        color: STATUS_COLORS[d.status] ?? "#aaa",
        label: STATUS_LABELS[d.status] ?? d.status,
      })),
    [leadsByStatus]
  );

  const hasLeads = leadsByMonth.some((d) => d.count > 0);
  const hasDonut = total > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Line chart — Leads this semester */}
      <Card className="rounded-2xl border border-border shadow-none">
        <CardHeader className="px-6 pt-5 pb-3 flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-ink">
              {t("dashboard.leadsSemester")}
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {t("dashboard.leadsByMonth")}
            </CardDescription>
          </div>
          <Badge className="bg-primary-soft text-primary-strong text-[10px] font-semibold px-2 py-0.5 rounded-full">
            6 {t("dashboard.months")}
          </Badge>
        </CardHeader>
        <CardContent className="px-4 pb-5">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={leadsByMonth} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: 12,
                  }}
                  cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {!hasLeads && (
            <p className="text-center text-xs text-muted-foreground -mt-4">
              {t("dashboard.noLeadsYet")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Donut — Leads Overview */}
      <Card className="rounded-2xl border border-border shadow-none">
        <CardHeader className="px-6 pt-5 pb-3 flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-ink">
              {t("dashboard.leadsOverview")}
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {t("dashboard.leadsByStatusAllTime")}
            </CardDescription>
          </div>
          <Badge className="bg-accent-soft text-accent-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full">
            {t("dashboard.allTime")}
          </Badge>
        </CardHeader>
        <CardContent className="px-6 pb-5">
          <div className="flex items-center gap-6">
            {/* Donut */}
            <div className="relative shrink-0 h-36 w-36">
              {hasDonut ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={62}
                      dataKey="count"
                      strokeWidth={0}
                      startAngle={90}
                      endAngle={-270}
                    >
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: 12,
                      }}
                      formatter={(value: number, _: string, props) => [value, (props as { payload?: { label?: string } })?.payload?.label ?? ""]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="52" fill="none" stroke="hsl(var(--muted))" strokeWidth="20" />
                </svg>
              )}
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold text-ink leading-none">{total}</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">{t("dashboard.leadsLabel")}</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex-1 space-y-2.5">
              {(hasDonut ? donutData : (Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>).map((k) => ({ status: k, label: STATUS_LABELS[k], count: 0, color: STATUS_COLORS[k] ?? "#aaa" }))).map((entry) => (
                <div key={entry.status} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-xs text-muted-foreground truncate">{entry.label}</span>
                  </div>
                  <span className="text-xs font-semibold text-ink tabular-nums">{entry.count}</span>
                </div>
              ))}
              <div className="border-t border-border pt-2 flex items-center justify-between">
                <span className="text-xs font-medium text-ink">{t("common.total")}</span>
                <span className="text-xs font-bold text-ink tabular-nums">{total}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
