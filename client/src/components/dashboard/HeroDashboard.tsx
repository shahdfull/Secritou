import { motion } from "motion/react";
import { ArrowRight, Bot, BarChart3, Lightbulb, Users, TrendingUp, Zap } from "lucide-react";
import { trackCtaClick } from "@/services/analytics.service";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function HeroDashboard() {
  const { t } = useTranslation();


  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden rounded-3xl border border-border bg-card shadow-lift">
        <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff605c]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd44]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#00ca4e]" />
          <div className="ml-3 hidden flex-1 sm:block">
            <div className="mx-auto max-w-xs rounded-md bg-background px-3 py-1 text-center text-[11px] font-medium text-muted-foreground">
              dashboard.secritou.local
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-3 p-4 sm:p-5">
          <KpiTile label={t("dashboardHero.kpis.revenue")} value="128 450 DT" delta="+18.4%" tone="primary" delay={0.1} />
          <KpiTile label={t("dashboardHero.kpis.newLeads")} value="2,847" delta="+12.1%" tone="ink" delay={0.18} />
          <KpiTile label={t("dashboardHero.kpis.conversion")} value="4.62%" delta="+0.8pt" tone="accent" delay={0.26} />

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.32 }} className="col-span-12 rounded-2xl border border-border bg-background p-4 sm:col-span-8 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t("dashboardHero.revenueTrend")}</p>
                <p className="mt-1 font-display text-lg font-bold text-ink">{t("dashboardHero.last12Months")}</p>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary-strong">
                <TrendingUp className="h-3 w-3" /> +24%
              </div>
            </div>
            <RevenueChart />
            <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /> {t("dashboardHero.revenue")}</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent" /> {t("dashboardHero.forecast")}</span>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }} className="col-span-12 rounded-2xl border border-border bg-background p-4 sm:col-span-4 sm:p-5">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary-soft">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t("dashboardHero.aiAssistant")}</p>
            </div>
            <div className="mt-3 space-y-2 rounded-xl bg-surface p-3">
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-ink">{t("dashboardHero.youLabel")}</p>
                <p>{t("dashboardHero.growthQuestion")}</p>
              </div>
              <div className="text-xs">
                <p className="font-medium text-primary">{t("dashboardHero.aiLabel")}</p>
                <p className="text-ink">{t("dashboardHero.growthAnswer")}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

     
    </div>
  );
}

function KpiTile({ label, value, delta, tone, delay }: { label: string; value: string; delta: string; tone: "primary" | "ink" | "accent"; delay: number; }) {
  const bg = tone === "primary" ? "bg-primary-soft" : tone === "accent" ? "bg-accent-soft" : "bg-surface";
  const badge = tone === "primary" ? "bg-primary text-primary-foreground" : tone === "accent" ? "bg-accent text-accent-foreground" : "bg-ink text-white";
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay }} className={`col-span-12 rounded-2xl p-4 sm:col-span-4 ${bg}`}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-center gap-1.5">
        <p className="w-[92px] font-display text-base font-bold leading-tight text-ink whitespace-nowrap">{value}</p>
        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${badge}`}>{delta}</span>
      </div>
    </motion.div>
  );
}

function RevenueChart() {
  const w = 520, h = 140;
  const revenue = [22, 30, 28, 42, 38, 55, 60, 72, 68, 88, 92, 110];
  const forecast = [25, 28, 32, 40, 45, 52, 64, 70, 78, 86, 98, 116];
  const max = 130;
  const toPath = (data: number[]) => data.map((v, i) => `${i === 0 ? "M" : "L"} ${(i / (data.length - 1)) * w} ${h - (v / max) * h}`).join(" ");
  const areaPath = `${toPath(revenue)} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-32 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.638 0.052 218)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="oklch(0.638 0.052 218)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" x2={w} y1={h * g} y2={h * g} stroke="oklch(0.9 0.01 60)" strokeDasharray="3 4" />)}
      <path d={areaPath} fill="url(#area)" />
      <path d={toPath(forecast)} stroke="oklch(0.808 0.048 30)" strokeWidth="2" strokeDasharray="4 4" fill="none" />
      <path d={toPath(revenue)} stroke="oklch(0.638 0.052 218)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
