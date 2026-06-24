import { motion } from "motion/react";
import { EyeOff, Workflow, Globe2, Hourglass } from "lucide-react";
import { useTranslation } from "react-i18next";

export function Problems() {
  const { t } = useTranslation();
  
  const problems = [
    {
      icon: EyeOff,
      title: t("home.problems.items.0.title"),
      body: t("home.problems.items.0.body"),
    },
    {
      icon: Workflow,
      title: t("home.problems.items.1.title"),
      body: t("home.problems.items.1.body"),
    },
    {
      icon: Globe2,
      title: t("home.problems.items.2.title"),
      body: t("home.problems.items.2.body"),
    },
    {
      icon: Hourglass,
      title: t("home.problems.items.3.title"),
      body: t("home.problems.items.3.body"),
    },
  ];

  return (
    <section className="bg-background py-14 sm:py-20">
      <div className="container-page">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t("home.problems.subtitle")}
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl lg:text-5xl">
            {t("home.problems.title")}
          </h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            {t("home.problems.description")}
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {problems.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className="rounded-2xl border border-border bg-card p-6 shadow-soft"
            >
              <div className="flex gap-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-ink">
                  <p.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-ink">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
