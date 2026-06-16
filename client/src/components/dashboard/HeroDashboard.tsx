import { motion } from "motion/react";
import { 
  ArrowUpRight, CheckCircle2, TrendingUp, Bot, Lightbulb, BarChart3, Users, ArrowRight, Calendar, Mail, Zap } from "lucide-react";
import { trackCtaClick } from "@/services/analytics.service";
import { Link } from "react-router-dom";

export function HeroDashboard() {
  const features = [
    { 
      icon: BarChart3, 
      title: "KPI Dashboard", 
      description: "Real-time metrics, dashboards and objectives tracking in one place" 
    },
    { 
      icon: Bot, 
      title: "AI Assistant", 
      description: "AI-powered chatbot that answers your business questions instantly" 
    },
    { 
      icon: Lightbulb, 
      title: "Growth Recommendations", 
      description: "Personalized, data-driven suggestions for growth" 
    },
    { 
      icon: TrendingUp, 
      title: "Business Insights", 
      description: "Deep analytics and actionable business intelligence" 
    },
    { 
      icon: Users, 
      title: "Team Performance", 
      description: "Track and optimize your team's productivity" 
    }
  ];

  return (
    <div className="space-y-6">
      {/* Browser chrome */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden rounded-3xl border border-border bg-card shadow-lift"
      >
        <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff605c]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd44]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#00ca4e]" />
          <div className="ml-3 hidden sm:block flex-1">
            <div className="mx-auto max-w-xs rounded-md bg-background px-3 py-1 text-center text-[11px] font-medium text-muted-foreground">
              app.secritou.com / future
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-3 p-4 sm:p-5">
          {/* KPI tiles */}
          <KpiTile label="Revenue" value="€128,450" delta="+18.4%" tone="primary" delay={0.1} />
          <KpiTile label="New Leads" value="2,847" delta="+12.1%" tone="ink" delay={0.18} />
          <KpiTile label="Conversion" value="4.62%" delta="+0.8pt" tone="accent" delay={0.26} />

          {/* Chart card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.32 }}
            className="col-span-12 lg:col-span-8 rounded-2xl border border-border bg-background p-4 sm:p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Revenue trend
                </p>
                <p className="mt-1 font-display text-lg font-bold text-ink">Last 12 months</p>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary">
                <TrendingUp className="h-3 w-3" /> +24%
              </div>
            </div>
            <RevenueChart />
            <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" /> Revenue
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent" /> Forecast
              </span>
            </div>
          </motion.div>

          {/* AI Assistant card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="col-span-12 lg:col-span-4 rounded-2xl border border-border bg-background p-4 sm:p-5"
          >
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary-soft">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                AI Assistant
              </p>
            </div>
            <div className="mt-3 rounded-xl bg-surface p-3 space-y-2">
              <div className="text-xs text-muted-foreground">
                <p className="text-ink font-medium">You:</p>
                <p>What's our top growth opportunity?</p>
              </div>
              <div className="text-xs">
                <p className="text-primary font-medium">Secritou AI:</p>
                <p className="text-ink">Focus on email campaigns - they drive 42% of conversions!</p>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Features section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="grid gap-3"
      >
        {features.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.55 + i * 0.08 }}
            className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface-warm">
              <feature.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-display text-sm font-bold text-ink">
                {feature.title}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {feature.description}
              </p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Join the Waitlist button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.9 }}
      >
        <Link
          to="/contact"
          onClick={() => trackCtaClick({ cta: "Join the Waitlist", location: "Future Vision" })}
          className="group flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5 w-full"
        >
          <Zap className="h-4 w-4" />
          Join the Waitlist
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </motion.div>

      {/* Floating badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1 }}
        className="absolute -top-5 -right-3 hidden md:flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-card"
      >
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft">
          <Lightbulb className="h-5 w-5 text-ink" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Future Vision
          </p>
          <p className="font-display text-base font-bold text-ink">Coming Soon</p>
        </div>
      </motion.div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  delta,
  tone,
  delay,
}: {
  label: string;
  value: string;
  delta: string;
  tone: "primary" | "ink" | "accent";
  delay: number;
}) {
  const bg =
    tone === "primary"
      ? "bg-primary-soft"
      : tone === "accent"
        ? "bg-accent-soft"
        : "bg-surface";
  const badge =
    tone === "primary"
      ? "bg-primary text-primary-foreground"
      : tone === "accent"
        ? "bg-accent text-accent-foreground"
        : "bg-ink text-white";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`col-span-12 sm:col-span-4 rounded-2xl ${bg} p-4`}
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="font-display text-xl font-bold text-ink">{value}</p>
        <span className={`rounded-full ${badge} px-2 py-0.5 text-[10px] font-semibold`}>
          {delta}
        </span>
      </div>
    </motion.div>
  );
}

function RevenueChart() {
  // Two smooth-ish series
  const w = 520;
  const h = 140;
  const revenue = [22, 30, 28, 42, 38, 55, 60, 72, 68, 88, 92, 110];
  const forecast = [25, 28, 32, 40, 45, 52, 64, 70, 78, 86, 98, 116];
  const max = 130;

  const toPath = (data: number[]) =>
    data
      .map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - (v / max) * h;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");

  const areaPath = `${toPath(revenue)} L ${w} ${h} L 0 ${h} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-3 h-32 w-full"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.638 0.052 218)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="oklch(0.638 0.052 218)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line
          key={g}
          x1="0"
          x2={w}
          y1={h * g}
          y2={h * g}
          stroke="oklch(0.9 0.01 60)"
          strokeDasharray="3 4"
        />
      ))}
      <path d={areaPath} fill="url(#area)" />
      <path
        d={toPath(forecast)}
        stroke="oklch(0.808 0.048 30)"
        strokeWidth="2"
        strokeDasharray="4 4"
        fill="none"
      />
      <path
        d={toPath(revenue)}
        stroke="oklch(0.638 0.052 218)"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
