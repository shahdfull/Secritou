// Mobile-responsive: updated 2026-06-29
//
// Responsive audit — fixed pixel widths (w-[Npx], N > 100) in client/src/features/landing/:
//   Hero.tsx          : w-[560px], w-[440px], w-[380px], w-[340px], w-[300px]
//   FutureProduct.tsx : w-[900px]
// All of the above are decorative, aria-hidden, absolutely-positioned blur orbs living
// inside `relative overflow-hidden` sections. They are clipped by their parent and never
// participate in layout flow, so they do NOT cause horizontal scroll or break mobile.
// No layout-bearing fixed widths were found — no fixes required for these.
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";
import { HeroDashboard } from "@/components/dashboard/HeroDashboard";
import { trackCtaClick } from "@/services/analytics.service";
import { useTranslation } from "react-i18next";
import { useLandingCms } from "@/providers/LandingCmsProvider";

export function Hero() {
  const { t } = useTranslation();
  const { cms } = useLandingCms();

  const tagline   = cms("hero.tagline",       t("home.hero.tagline"));
  const title0    = cms("hero.title.0",        t("home.hero.title.0"));
  const title1    = cms("hero.title.1",        t("home.hero.title.1"));
  const title2    = cms("hero.title.2",        t("home.hero.title.2"));
  const desc      = cms("hero.description",    t("home.hero.description"));
  const ctaPrim   = cms("hero.cta.primary",    t("home.cta.primary"));
  const ctaSec    = cms("hero.cta.secondary",  t("home.cta.secondary"));

  const features = [
    t("home.hero.features.0"),
    t("home.hero.features.1"),
    t("home.hero.features.2"),
    t("home.hero.features.3"),
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-surface-warm/70 via-background to-background pt-3 pb-8 lg:pt-4 lg:pb-10">
      {/* Decorative blur — large gaussian blurs are expensive to rasterize on
          low-end mobile GPUs: keep 2 orbs on mobile, all 5 from sm: up. */}
      <div aria-hidden className="absolute -top-32 -right-20 h-[560px] w-[560px] rounded-full bg-primary/50 opacity-90 blur-3xl" />
      <div aria-hidden className="absolute top-32 -left-24 h-[440px] w-[440px] rounded-full bg-accent/55 opacity-90 blur-3xl" />
      <div aria-hidden className="hidden sm:block absolute -bottom-24 left-1/3 h-[380px] w-[380px] rounded-full bg-accent/40 opacity-80 blur-3xl" />
      <div aria-hidden className="hidden sm:block absolute bottom-0 -right-10 h-[340px] w-[340px] rounded-full bg-primary/40 opacity-80 blur-3xl" />
      <div aria-hidden className="hidden sm:block absolute top-1/2 left-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/25 opacity-70 blur-3xl" />

      <div className="container-page relative grid items-start gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-8">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-medium text-ink backdrop-blur"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {tagline}
          </motion.div>

          {/* LCP element: rendered immediately, never animated from opacity 0 —
              animating it delays the reported LCP by the animation duration. */}
          <h1 className="mt-4 font-display text-[32px] leading-[1.1] font-bold tracking-tight text-ink sm:text-4xl lg:text-[56px]">
            {title0}
            <span className="relative inline-block">
              <span className="relative z-10">{title1}</span>
              <span aria-hidden className="absolute inset-x-0 bottom-1.5 -z-0 h-3 bg-accent-soft sm:h-4" />
            </span>
            {title2}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base"
          >
            {desc}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-6 flex flex-wrap items-center gap-3"
          >
            <Link
              to="/contact"
              onClick={() => trackCtaClick({ cta: ctaPrim, location: "Hero" })}
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5"
            >
              {ctaPrim}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/services"
              onClick={() => trackCtaClick({ cta: ctaSec, location: "Hero" })}
              className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-background px-6 text-sm font-semibold text-ink transition-colors hover:bg-surface"
            >
              {ctaSec}
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-medium text-muted-foreground sm:gap-x-6 sm:text-xs"
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
