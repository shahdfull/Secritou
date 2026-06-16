import { motion } from "motion/react";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Settings,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Overview", active: true },
  { icon: BarChart3, label: "Analytics" },
  { icon: Users, label: "Customers" },
  { icon: Zap, label: "Automations" },
  { icon: Settings, label: "Settings" },
];

const kpis = [
  { label: "MRR", value: "€42,180", delta: "+12.4%", up: true },
  { label: "Active customers", value: "1,284", delta: "+8.1%", up: true },
  { label: "Churn", value: "1.8%", delta: "-0.3pt", up: false, invert: true },
  { label: "NPS", value: "62", delta: "+4", up: true },
];

const channels = [
  { name: "Organic", value: 64, color: "bg-primary" },
  { name: "Paid", value: 42, color: "bg-accent" },
  { name: "Referral", value: 28, color: "bg-ink" },
  { name: "Direct", value: 36, color: "bg-primary-soft" },
];

export function ProductDashboard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-3xl border border-border bg-card shadow-lift"
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff605c]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd44]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#00ca4e]" />
        <div className="ml-3 hidden sm:block flex-1">
          <div className="mx-auto max-w-sm rounded-md bg-background px-3 py-1 text-center text-[11px] font-medium text-muted-foreground">
            app.secritou.com / growth-os
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12">
        {/* Sidebar */}
        <aside className="hidden lg:flex col-span-2 flex-col gap-1 border-r border-border bg-surface/60 p-4">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Workspace
          </p>
          {navItems.map((item, i) => (
            <div
              key={i}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm ${
                item.active
                  ? "bg-background font-semibold text-ink shadow-soft"
                  : "text-muted-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </div>
          ))}
        </aside>

        {/* Main */}
        <div className="col-span-12 lg:col-span-10 p-4 sm:p-6 space-y-5">
          {/* Header row */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Overview � Last 30 days
              </p>
              <h3 className="mt-1 font-display text-xl sm:text-2xl font-bold text-ink">
                Your growth at a glance
              </h3>
            </div>
            <div className="flex gap-2">
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
                30D
              </span>
              <span className="rounded-full bg-ink px-3 py-1 text-xs font-medium text-white">
                Live
              </span>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kpis.map((k, i) => (
              <div key={i} className="rounded-2xl border border-border bg-background p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {k.label}
                </p>
                <p className="mt-2 font-display text-xl font-bold text-ink">{k.value}</p>
                <p
                  className={`mt-1 inline-flex items-center gap-1 text-[11px] font-semibold ${
                    (k.up && !k.invert) || (!k.up && k.invert)
                      ? "text-primary"
                      : "text-accent-foreground"
                  }`}
                >
                  {k.up ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {k.delta}
                </p>
              </div>
            ))}
          </div>

          {/* Big chart + channels */}
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-2xl border border-border bg-background p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <p className="font-display text-sm font-semibold text-ink">
                  Revenue & customers
                </p>
                <span className="text-[11px] text-muted-foreground">Weekly</span>
              </div>
              <BarSeries />
            </div>

            <div className="rounded-2xl border border-border bg-background p-4 sm:p-5">
              <p className="font-display text-sm font-semibold text-ink">
                Acquisition channels
              </p>
              <ul className="mt-4 space-y-3">
                {channels.map((c) => (
                  <li key={c.name}>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{c.name}</span>
                      <span className="font-semibold text-ink">{c.value}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface">
                      <div
                        className={`h-full rounded-full ${c.color}`}
                        style={{ width: `${c.value}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Customer table */}
          <div className="rounded-2xl border border-border bg-background overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-border">
              <p className="font-display text-sm font-semibold text-ink">Top accounts</p>
              <span className="text-[11px] text-muted-foreground">Updated 2m ago</span>
            </div>
            <table className="w-full text-xs sm:text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 sm:px-5 py-2.5 font-medium">Account</th>
                  <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Plan</th>
                  <th className="px-4 py-2.5 font-medium">MRR</th>
                  <th className="px-4 sm:px-5 py-2.5 font-medium text-right">Health</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { n: "Atlas Studio", p: "Growth", m: "€3,200", h: "Healthy", color: "primary" },
                  { n: "Nordic Bistro", p: "Scale", m: "€2,480", h: "At risk", color: "accent" },
                  { n: "Helix Labs", p: "Growth", m: "€1,940", h: "Healthy", color: "primary" },
                  { n: "Verra Retail", p: "Starter", m: "€1,210", h: "Healthy", color: "primary" },
                ].map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-4 sm:px-5 py-2.5 font-medium text-ink">{r.n}</td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">
                      {r.p}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-ink">{r.m}</td>
                    <td className="px-4 sm:px-5 py-2.5 text-right">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          r.color === "primary"
                            ? "bg-primary-soft text-primary"
                            : "bg-accent-soft text-accent-foreground"
                        }`}
                      >
                        {r.h}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function BarSeries() {
  const data = [
    { rev: 32, cust: 22 },
    { rev: 44, cust: 28 },
    { rev: 38, cust: 34 },
    { rev: 56, cust: 40 },
    { rev: 62, cust: 48 },
    { rev: 74, cust: 52 },
    { rev: 88, cust: 60 },
    { rev: 95, cust: 68 },
  ];
  const max = 100;
  return (
    <div className="mt-4 flex h-40 items-end gap-2 sm:gap-3">
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 items-end gap-1">
          <div
            className="flex-1 rounded-t-md bg-primary"
            style={{ height: `${(d.rev / max) * 100}%` }}
          />
          <div
            className="flex-1 rounded-t-md bg-accent"
            style={{ height: `${(d.cust / max) * 100}%` }}
          />
        </div>
      ))}
    </div>
  );
}
