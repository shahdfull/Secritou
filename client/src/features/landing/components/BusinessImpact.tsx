import { TrendingUp, Zap, Target, BarChart3 } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

const businessImpactItems = [
  {
    icon: TrendingUp,
    titleKey: "businessImpact.items.visibility.title",
    descriptionKey: "businessImpact.items.visibility.description",
    metric: "+42%",
    labelKey: "businessImpact.items.visibility.label",
  },
  {
    icon: Zap,
    titleKey: "businessImpact.items.speed.title",
    descriptionKey: "businessImpact.items.speed.description",
    metric: "-50%",
    labelKey: "businessImpact.items.speed.label",
  },
  {
    icon: Target,
    titleKey: "businessImpact.items.productivity.title",
    descriptionKey: "businessImpact.items.productivity.description",
    metric: "+35%",
    labelKey: "businessImpact.items.productivity.label",
  },
  {
    icon: BarChart3,
    titleKey: "businessImpact.items.growth.title",
    descriptionKey: "businessImpact.items.growth.description",
    metric: "+68%",
    labelKey: "businessImpact.items.growth.label",
  },
];

export function BusinessImpact() {
  const { t } = useTranslation();

  return (
    <section className="bg-background py-20 sm:py-28">
      <div className="container-page">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t("businessImpact.subtitle")}
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl lg:text-5xl">
            {t("businessImpact.title")}
          </h2>
          <p className="mt-5 text-base text-muted-foreground sm:text-lg">
            {t("businessImpact.description")}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {businessImpactItems.map((item, index) => (
            <motion.div
              key={item.titleKey}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="rounded-3xl border border-border bg-card p-6 shadow-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-ink">{t(item.titleKey)}</h3>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-xl font-bold text-primary">{item.metric}</p>
                  <p className="text-xs text-muted-foreground">{t(item.labelKey)}</p>
                </div>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(item.descriptionKey)}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
