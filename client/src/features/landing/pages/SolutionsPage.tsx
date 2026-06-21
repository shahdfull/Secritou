import { Building2, Compass, Mic2 } from "lucide-react";
import { FinalCTA } from "@/features/landing/components/FinalCTA";
import { trackSolutionSegmentClicked, trackSolutionNeedClicked } from "@/services/analytics.service";
import { useTranslation } from "react-i18next";

export function SolutionsPage() {
  const { t } = useTranslation();

  const segments = [
    {
      icon: Building2,
      tagKey: "solutionsPage.sections.smes.tag",
      titleKey: "solutionsPage.sections.smes.title",
      needsKeys: [
        { h: "solutionsPage.sections.smes.needs.0.h", b: "solutionsPage.sections.smes.needs.0.b" },
        { h: "solutionsPage.sections.smes.needs.1.h", b: "solutionsPage.sections.smes.needs.1.b" },
        { h: "solutionsPage.sections.smes.needs.2.h", b: "solutionsPage.sections.smes.needs.2.b" },
      ],
      outcomeKey: "solutionsPage.sections.smes.outcome",
    },
    {
      icon: Compass,
      tagKey: "solutionsPage.sections.entrepreneurs.tag",
      titleKey: "solutionsPage.sections.entrepreneurs.title",
      needsKeys: [
        { h: "solutionsPage.sections.entrepreneurs.needs.0.h", b: "solutionsPage.sections.entrepreneurs.needs.0.b" },
        { h: "solutionsPage.sections.entrepreneurs.needs.1.h", b: "solutionsPage.sections.entrepreneurs.needs.1.b" },
        { h: "solutionsPage.sections.entrepreneurs.needs.2.h", b: "solutionsPage.sections.entrepreneurs.needs.2.b" },
      ],
      outcomeKey: "solutionsPage.sections.entrepreneurs.outcome",
    },
    {
      icon: Mic2,
      tagKey: "solutionsPage.sections.creators.tag",
      titleKey: "solutionsPage.sections.creators.title",
      needsKeys: [
        { h: "solutionsPage.sections.creators.needs.0.h", b: "solutionsPage.sections.creators.needs.0.b" },
        { h: "solutionsPage.sections.creators.needs.1.h", b: "solutionsPage.sections.creators.needs.1.b" },
        { h: "solutionsPage.sections.creators.needs.2.h", b: "solutionsPage.sections.creators.needs.2.b" },
      ],
      outcomeKey: "solutionsPage.sections.creators.outcome",
    },
  ];

  return (
    <>
      <section className="bg-gradient-to-b from-surface-warm/70 to-background pt-20 pb-16 sm:pt-28">
        <div className="container-page max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t("nav.solutions")}
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold text-ink sm:text-5xl lg:text-6xl">
            {t("solutionsPage.title")}
          </h1>
          <p className="mt-5 text-base text-muted-foreground sm:text-lg">
            {t("solutionsPage.subtitle")}
          </p>
        </div>
      </section>

      <section className="bg-background pb-24">
        <div className="container-page space-y-6">
          {segments.map((s) => (
            <article
              key={s.tagKey}
              className="grid gap-8 rounded-3xl border border-border bg-card p-8 shadow-soft lg:grid-cols-[1.05fr_1fr] lg:p-10"
            >
              <button
                type="button"
                onClick={() => trackSolutionSegmentClicked({ segment: t(s.tagKey) })}
                className="text-left w-full"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-ink">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <p className="font-display text-2xl font-bold uppercase text-ink">
                    {t(s.tagKey)}
                  </p>
                </div>
                <h2 className="mt-5 text-xs font-semibold tracking-wider text-primary">{t(s.titleKey)}</h2>

              </button>
              <ul className="grid gap-3">
                {s.needsKeys.map((n) => (
                  <button
                    key={n.h}
                    type="button"
                    onClick={() => trackSolutionNeedClicked({ segment: t(s.tagKey), need: t(n.h) })}
                    className="rounded-2xl border border-border bg-background p-5 text-left w-full hover:bg-surface transition-colors"
                  >
                    <h3 className="font-display text-base font-semibold text-ink">{t(n.h)}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t(n.b)}</p>
                  </button>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <FinalCTA />
    </>
  );
}
