import { ArrowUpRight } from "lucide-react";
import { FinalCTA } from "@/features/landing/components/FinalCTA";
import { useTranslation } from "react-i18next";

const extendedCases = [
  {
    industryKey: "home.footer.industries.retail",
    company: "Nordic Bistro Group",
    challengeKey: "solutionsPage.sections.smes.needs.0.b",
    outcomeKey: "solutionsPage.sections.smes.needs.1.b",
    metric: "+34%",
    metricLabelKey: "caseStudiesPage.metricLabel",
  },
  {
    industryKey: "home.footer.industries.professionalServices",
    company: "Atlas Studio",
    challengeKey: "solutionsPage.sections.startuppers.needs.0.b",
    outcomeKey: "solutionsPage.sections.startuppers.needs.1.b",
    metric: "3.8×",
    metricLabelKey: "caseStudiesPage.metricLabel",
  },
  {
    industryKey: "home.footer.industries.startups",
    company: "Helix Labs",
    challengeKey: "solutionsPage.sections.brands.needs.0.b",
    outcomeKey: "solutionsPage.sections.brands.needs.1.b",
    metric: "+42k DT",
    metricLabelKey: "caseStudiesPage.metricLabel",
  },
  {
    industryKey: "home.footer.industries.healthcare",
    company: "Northwave Clinics",
    challengeKey: "solutionsPage.sections.smes.needs.1.b",
    outcomeKey: "solutionsPage.sections.smes.needs.2.b",
    metric: "+58%",
    metricLabelKey: "caseStudiesPage.metricLabel",
  },
];

export function CaseStudiesPage() {
  const { t } = useTranslation();

  return (
    <>
      <section className="bg-gradient-to-b from-surface-warm/70 to-background pt-20 pb-16 sm:pt-28">
        <div className="container-page max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t("nav.caseStudies")}
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold text-ink sm:text-5xl lg:text-6xl">
            {t("caseStudiesPage.title")}
          </h1>
          <p className="mt-5 text-base text-muted-foreground sm:text-lg">
            {t("caseStudiesPage.subtitle")}
          </p>
        </div>
      </section>

      <section className="bg-background pb-24">
        <div className="container-page grid gap-5 lg:grid-cols-2">
          {extendedCases.map((c) => (
            <article
              key={c.company}
              className="flex flex-col rounded-3xl border border-border bg-card p-8 shadow-soft"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center rounded-full bg-surface-warm/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t(c.industryKey)}
                </span>
                <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
              </div>
              <h2 className="mt-5 font-display text-2xl font-bold text-ink">{c.company}</h2>
              <p className="mt-4 text-sm text-muted-foreground">
                <span className="font-semibold text-ink">{t("caseStudiesPage.challenge")}.</span> {t(c.challengeKey)}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                <span className="font-semibold text-ink">{t("caseStudiesPage.outcome")}.</span> {t(c.outcomeKey)}
              </p>
              <div className="mt-auto pt-6">
                <div className="flex items-end justify-between rounded-2xl bg-primary-soft px-5 py-4">
                  <div>
                    <p className="font-display text-3xl font-bold text-ink">{c.metric}</p>
                    <p className="text-xs text-muted-foreground">{t(c.metricLabelKey)}</p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <FinalCTA />
    </>
  );
}
