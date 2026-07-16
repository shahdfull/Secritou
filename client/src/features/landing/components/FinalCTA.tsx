import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { trackCtaClick } from "@/services/analytics.service";
import { useTranslation } from "react-i18next";
import { useLandingCms } from "@/providers/LandingCmsProvider";

// Fixed palette (not a free color picker) so an admin can't accidentally
// land white text on a white background — see conversation on "palette
// limitee par section".
const BACKGROUND_CLASS: Record<string, string> = {
  ink: "bg-ink",
  primary: "bg-primary",
  "surface-warm": "bg-surface-warm",
  none: "bg-card border border-border",
};

const isLightBackground = (bg: string) => bg === "surface-warm" || bg === "none";

export function FinalCTA() {
  const { t } = useTranslation();
  const { cms } = useLandingCms();

  const subtitle = cms("finalCta.subtitle", t("home.finalCta.subtitle"));
  const title = cms("finalCta.title", t("home.finalCta.title"));
  const description = cms("finalCta.description", t("home.finalCta.description"));
  const background = cms("finalCta.background", "ink");
  const ctaPrimaryLabel = cms("finalCta.ctaPrimaryLabel", t("home.cta.primary"));
  const ctaPrimaryHref = cms("finalCta.ctaPrimaryHref", "/contact");
  const ctaSecondaryLabel = cms("finalCta.ctaSecondaryLabel", t("home.cta.secondary"));
  const ctaSecondaryHref = cms("finalCta.ctaSecondaryHref", "/#services");

  const light = isLightBackground(background);
  const bandClass = BACKGROUND_CLASS[background] ?? BACKGROUND_CLASS.ink;
  const titleClass = light ? "text-ink" : "text-white";
  const descriptionClass = light ? "text-muted-foreground" : "text-white/70";
  const subtitleClass = light ? "text-primary" : "text-accent";
  const primaryBtnClass = light ? "bg-ink text-white" : "bg-white text-ink";
  const secondaryBtnClass = light
    ? "border border-border text-ink hover:bg-surface"
    : "border border-white/20 text-white hover:bg-white/10";

  return (
    <section className="bg-background py-14 sm:py-20">
      <div className="container-page">
        <div className={`relative overflow-hidden rounded-[2rem] px-8 py-12 text-center sm:px-16 sm:py-16 ${bandClass}`}>
          {!light && (
            <>
              <div aria-hidden className="absolute -top-20 -left-20 h-80 w-80 rounded-full bg-primary opacity-30 blur-3xl" />
              <div aria-hidden className="absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-accent opacity-30 blur-3xl" />
            </>
          )}
          <div className="relative mx-auto max-w-2xl">
            <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${subtitleClass}`}>{subtitle}</p>
            <h2 className={`mt-3 font-display text-3xl font-bold sm:text-4xl lg:text-5xl ${titleClass}`}>{title}</h2>
            <p className={`mt-5 text-base sm:text-lg ${descriptionClass}`}>{description}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to={ctaPrimaryHref}
                onClick={() => trackCtaClick({ cta: ctaPrimaryLabel, location: "Final CTA" })}
                className={`group inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold shadow-soft transition-transform hover:-translate-y-0.5 ${primaryBtnClass}`}
              >
                {ctaPrimaryLabel}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              {ctaSecondaryLabel && (
                <Link
                  to={ctaSecondaryHref}
                  onClick={() => trackCtaClick({ cta: ctaSecondaryLabel, location: "Final CTA" })}
                  className={`inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-semibold transition-colors ${secondaryBtnClass}`}
                >
                  {ctaSecondaryLabel}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
