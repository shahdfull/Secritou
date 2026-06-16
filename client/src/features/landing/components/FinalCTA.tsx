import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { trackCtaClick } from "@/services/analytics.service";
import { useTranslation } from "react-i18next";

export function FinalCTA() {
  const { t } = useTranslation();
  
  return (
    <section className="bg-background py-20 sm:py-28">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-[2rem] bg-ink px-8 py-16 text-center sm:px-16 sm:py-24">
          <div
            aria-hidden
            className="absolute -top-20 -left-20 h-80 w-80 rounded-full bg-primary opacity-30 blur-3xl"
          />
          <div
            aria-hidden
            className="absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-accent opacity-30 blur-3xl"
          />
          <div className="relative mx-auto max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              {t("home.finalCta.subtitle")}
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
              {t("home.finalCta.title")}
            </h2>
            <p className="mt-5 text-base text-white/70 sm:text-lg">
              {t("home.finalCta.description")}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/contact"
                onClick={() => trackCtaClick({ cta: t("nav.scheduleFreeConsultation"), location: "Final CTA" })}
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-ink transition-transform hover:-translate-y-0.5"
              >
                {t("nav.scheduleFreeConsultation")}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/case-studies"
                onClick={() => trackCtaClick({ cta: t("home.finalCta.seeResults"), location: "Final CTA" })}
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/20 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                {t("home.finalCta.seeResults")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
