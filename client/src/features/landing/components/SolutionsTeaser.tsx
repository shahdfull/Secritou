import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Building2, Compass, Store, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

const segments = [
  {
    icon: Building2,
    tagKey: "solutionsTeaser.segments.smes.tag",
    titleKey: "solutionsTeaser.segments.smes.title",
    needsKeys: [
      "solutionsTeaser.segments.smes.needs.0",
      "solutionsTeaser.segments.smes.needs.1",
      "solutionsTeaser.segments.smes.needs.2",
    ],
  },
  {
    icon: Compass,
    tagKey: "solutionsTeaser.segments.entrepreneurs.tag",
    titleKey: "solutionsTeaser.segments.entrepreneurs.title",
    needsKeys: [
      "solutionsTeaser.segments.entrepreneurs.needs.0",
      "solutionsTeaser.segments.entrepreneurs.needs.1",
      "solutionsTeaser.segments.entrepreneurs.needs.2",
    ],
  },
  {
    icon: Store,
    tagKey: "solutionsTeaser.segments.creators.tag",
    titleKey: "solutionsTeaser.segments.creators.title",
    needsKeys: [
      "solutionsTeaser.segments.creators.needs.0",
      "solutionsTeaser.segments.creators.needs.1",
      "solutionsTeaser.segments.creators.needs.2",
    ],
  },
];

export function SolutionsTeaser() {
  const { t } = useTranslation();

  return (
    <section className="bg-surface-warm/40 py-14 sm:py-20">
      <div className="container-page">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {t("solutionsTeaser.subtitle")}
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl lg:text-5xl">
              {t("solutionsTeaser.title")}
            </h2>
          </div>
          <Link
            to="/solutions"
          className="group inline-flex items-center gap-2 text-sm font-semibold text-ink"
        >
            {t("solutionsTeaser.seeAll")}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {segments.map((s, i) => (
            <motion.div
              key={s.tagKey}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="rounded-3xl border border-border bg-card p-7 shadow-soft"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-ink">
                  <s.icon className="h-5 w-5" />
                </div>
                <p className="font-display text-xl font-bold uppercase text-ink">
                  {t(s.tagKey)}
                </p>
              </div>
              <h3 className="mt-5 text-xs font-semibold tracking-wider text-primary">{t(s.titleKey)}</h3>
              <ul className="mt-5 space-y-2 text-sm text-ink">
                {s.needsKeys.map((n) => (
                  <li key={n} className="flex items-center gap-2">
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-primary text-[9px] text-primary-foreground">
                      ✓
                    </span>
                    {t(n)}
                  </li>
                ))}
              </ul>
              <Link
                to="/solutions"
                className="mt-7 inline-flex items-center gap-1.5 text-sm font-semibold text-ink hover:text-primary"
              >
                {t("solutionsTeaser.explore")} <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
