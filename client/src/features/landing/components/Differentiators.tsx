import { motion } from "motion/react";
import { Compass, LineChart, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

const items = [
  {
    icon: Compass,
    titleKey: "differentiators.items.strategy.title",
    bodyKey: "differentiators.items.strategy.body",
  },
  {
    icon: LineChart,
    titleKey: "differentiators.items.data.title",
    bodyKey: "differentiators.items.data.body",
  },
  {
    icon: Users,
    titleKey: "differentiators.items.team.title",
    bodyKey: "differentiators.items.team.body",
  },
];

export function Differentiators() {
  const { t } = useTranslation();

  return (
    <section className="bg-background py-14 sm:py-20">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t("differentiators.subtitle")}
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl lg:text-5xl">
            {t("differentiators.title")}
          </h2>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {items.map((it, i) => (
            <motion.div
              key={it.titleKey}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="rounded-3xl border border-border bg-card p-8 shadow-soft"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ink text-white">
                  <it.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-xl font-bold text-ink">{t(it.titleKey)}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t(it.bodyKey)}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
