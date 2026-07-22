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
import { useTranslation } from "react-i18next";

const navItems: Array<{ icon: typeof LayoutDashboard; labelKey: string; active?: boolean }> = [
  { icon: LayoutDashboard, labelKey: "dashboardProduct.nav.overview", active: true },
  { icon: BarChart3, labelKey: "dashboardProduct.nav.analytics" },
  { icon: Users, labelKey: "dashboardProduct.nav.customers" },
  { icon: Zap, labelKey: "dashboardProduct.nav.automations" },
  { icon: Settings, labelKey: "dashboardProduct.nav.settings" },
] as const;

const kpis = [
  { labelKey: "dashboardProduct.kpis.mrr", value: "42 180 DT", delta: "+12.4%", up: true },
  { labelKey: "dashboardProduct.kpis.activeCustomers", value: "1,284", delta: "+8.1%", up: true },
  { labelKey: "dashboardProduct.kpis.churn", value: "1.8%", delta: "-0.3pt", up: false, invert: true },
  { labelKey: "dashboardProduct.kpis.nps", value: "62", delta: "+4", up: true },
];

const channels = [
  { nameKey: "dashboardProduct.channels.organic", value: 64, color: "bg-primary" },
  { nameKey: "dashboardProduct.channels.paid", value: 42, color: "bg-accent" },
  { nameKey: "dashboardProduct.channels.referral", value: 28, color: "bg-ink" },
  { nameKey: "dashboardProduct.channels.direct", value: 36, color: "bg-primary-soft" },
];

export function ProductDashboard() {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-3xl border border-border bg-card shadow-lift"
    >
      <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff605c]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd44]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#00ca4e]" />
        <div className="ml-3 hidden flex-1 sm:block">
          <div className="mx-auto max-w-sm rounded-md bg-background px-3 py-1 text-center text-[11px] font-medium text-muted-foreground">
            {t("dashboardProduct.browserUrl")}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12">
        <aside className="hidden flex-col gap-1 border-r border-border bg-surface/60 p-4 lg:col-span-2 lg:flex">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("dashboardProduct.workspace")}
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
              {t(item.labelKey)}
            </div>
          ))}
        </aside>

        <div className="col-span-12 space-y-5 p-4 sm:p-6 lg:col-span-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("dashboardProduct.header")}
              </p>
              <h3 className="mt-1 font-display text-xl font-bold text-ink sm:text-2xl">
                {t("dashboardProduct.title")}
              </h3>
            </div>
            <div className="flex gap-2">
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
                {t("dashboardProduct.period")}
              </span>
              <span className="rounded-full bg-ink px-3 py-1 text-xs font-medium text-white">
                {t("dashboardProduct.live")}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpis.map((k, i) => (
              <div key={i} className="rounded-2xl border border-border bg-background p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {t(k.labelKey)}
                </p>
                <p className="mt-2 font-display text-xl font-bold text-ink">{k.value}</p>
                <p
                  className={`mt-1 inline-flex items-center gap-1 text-[11px] font-semibold ${
                    (k.up && !k.invert) || (!k.up && k.invert)
                      ? "text-primary"
                      : "text-accent-foreground"
                  }`}
                >
                  {k.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {k.delta}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-border bg-background p-4 sm:col-span-2 sm:p-5 lg:col-span-2">
              <div className="flex items-center justify-between">
                <p className="font-display text-sm font-semibold text-ink">
                  {t("dashboardProduct.revenueCustomers")}
                </p>
                <span className="text-[11px] text-muted-foreground">{t("dashboardProduct.weekly")}</span>
              </div>
              <BarSeries />
            </div>

            <div className="rounded-2xl border border-border bg-background p-4 sm:p-5">
              <p className="font-display text-sm font-semibold text-ink">
                {t("dashboardProduct.channelsTitle")}
              </p>
              <ul className="mt-4 space-y-3">
                {channels.map((c) => (
                  <li key={c.nameKey}>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{t(c.nameKey)}</span>
                      <span className="font-semibold text-ink">{c.value}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface">
                      <div className={`h-full rounded-full ${c.color}`} style={{ width: `${c.value}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-background">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
              <p className="font-display text-sm font-semibold text-ink">{t("dashboardProduct.topAccounts")}</p>
              <span className="text-[11px] text-muted-foreground">{t("dashboardProduct.updatedAgo")}</span>
            </div>
            <table className="w-full text-xs sm:text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium sm:px-5">{t("dashboardProduct.account")}</th>
                  <th className="hidden px-4 py-2.5 font-medium sm:table-cell">{t("dashboardProduct.plan")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("dashboardProduct.mrr")}</th>
                  <th className="px-4 py-2.5 font-medium text-right sm:px-5">{t("dashboardProduct.health")}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { n: "Atlas Studio", p: "Growth", m: "3 200 DT", h: "Healthy", color: "primary" },
                  { n: "Nordic Bistro", p: "Scale", m: "2 480 DT", h: "At risk", color: "accent" },
                  { n: "Helix Labs", p: "Growth", m: "1 940 DT", h: "Healthy", color: "primary" },
                  { n: "Verra Retail", p: "Starter", m: "1 210 DT", h: "Healthy", color: "primary" },
                ].map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-4 py-2.5 font-medium text-ink sm:px-5">{r.n}</td>
                    <td className="hidden px-4 py-2.5 text-muted-foreground sm:table-cell">{r.p}</td>
                    <td className="px-4 py-2.5 font-semibold text-ink">{r.m}</td>
                    <td className="px-4 py-2.5 text-right sm:px-5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.color === "primary" ? "bg-primary-soft text-primary-strong" : "bg-accent-soft text-accent-strong"}`}>
                        {t(`dashboardProduct.healthLabels.${r.h === "Healthy" ? "healthy" : "atRisk"}`)}
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
          <div className="flex-1 rounded-t-md bg-primary" style={{ height: `${(d.rev / max) * 100}%` }} />
          <div className="flex-1 rounded-t-md bg-accent" style={{ height: `${(d.cust / max) * 100}%` }} />
        </div>
      ))}
    </div>
  );
}
