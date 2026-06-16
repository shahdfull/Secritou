import { TrendingUp, Zap, Target, BarChart3, ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";

const businessImpactItems = [
  {
    icon: TrendingUp,
    title: "Better Visibility",
    description: "Full transparency into all key metrics and performance in one centralized dashboard.",
    metric: "+42%",
    label: "Improved visibility",
  },
  {
    icon: Zap,
    title: "Faster Decision Making",
    description: "Real-time insights that cut decision time in half.",
    metric: "-50%",
    label: "Decision speed",
  },
  {
    icon: Target,
    title: "Increased Productivity",
    description: "Automated workflows free up your team to focus on high-impact work.",
    metric: "+35%",
    label: "Productivity gain",
  },
  {
    icon: BarChart3,
    title: "Growth Tracking",
    description: "Track, forecast, and optimize growth with clear KPIs.",
    metric: "+68%",
    label: "Growth accuracy",
  },
];

export function BusinessImpact() {
  return (
    <section className="bg-background py-20 sm:py-28">
      <div className="container-page">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Business Impact</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl lg:text-5xl">
            Measurable outcomes you can trust
          </h2>
          <p className="mt-5 text-base text-muted-foreground sm:text-lg">
            See exactly how our platform drives real growth for your business.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {businessImpactItems.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="rounded-3xl border border-border bg-card p-6 shadow-soft"
            >
              <div className="flex items-start justify-between">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
                  <item.icon className="h-6 w-6" />
                </div>
                <div className="text-right">
                  <p className="font-display text-xl font-bold text-primary">{item.metric}</p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-ink">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
