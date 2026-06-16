import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";
import { HeroDashboard } from "@/components/dashboard/HeroDashboard";
import { trackCtaClick } from "@/services/analytics.service";
import { useTranslation } from "react-i18next";

export function Hero() {
  const { t } = useTranslation();
  
  const features = [
    t("home.hero.features.0"),
    t("home.hero.features.1"),
    t("home.hero.features.2"),
    t("home.hero.features.3"),
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-surface-warm/70 via-background to-background pt-4 pb-16 lg:pt-8 lg:pb-20">
      {/* Decorative blur */}
      <div
        aria-hidden
        className="absolute -top-32 -right-20 h-[420px] w-[420px] rounded-full bg-primary-soft opacity-60 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute top-40 -left-20 h-[320px] w-[320px] rounded-full bg-accent-soft opacity-60 blur-3xl"
      />

      <div className="container-page relative grid items-start gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-medium text-ink backdrop-blur"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {t("home.hero.tagline")}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mt-5 font-display text-[40px] leading-[1.05] font-bold tracking-tight text-ink sm:text-5xl lg:text-[64px]"
          >
            {t("home.hero.title.0")}
            <span className="relative inline-block">
              <span className="relative z-10">{t("home.hero.title.1")}</span>
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-1.5 -z-0 h-3 bg-accent-soft sm:h-4"
              />
            </span>
            {t("home.hero.title.2")}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            {t("home.hero.description")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Link
              to="/contact"
              onClick={() => trackCtaClick({ cta: t("nav.bookFreeConsultation"), location: "Hero" })}
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5"
            >
              {t("nav.bookFreeConsultation")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/services"
              onClick={() => trackCtaClick({ cta: t("nav.discoverSolutions"), location: "Hero" })}
              className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-background px-6 text-sm font-semibold text-ink transition-colors hover:bg-surface"
            >
              {t("nav.discoverSolutions")}
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-muted-foreground"
          >
            {features.map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <span className="grid h-4 w-4 place-items-center rounded-full bg-primary text-[9px] text-primary-foreground">
                  ✓
                </span>
                {item}
              </span>
            ))}
          </motion.div>
        </div>

        <div className="relative">
          <HeroDashboard />
        </div>
      </div>
    </section>
  );
}
