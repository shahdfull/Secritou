import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLandingCms } from "@/providers/LandingCmsProvider";

type CaseStudyItem = {
  company: string;
  industry: string;
  challenge: string;
  outcome: string;
  metric: string;
  metricLabel: string;
};

const DEFAULT_ITEMS: CaseStudyItem[] = [
  { company: "", industry: "", challenge: "", outcome: "", metric: "", metricLabel: "" },
  { company: "", industry: "", challenge: "", outcome: "", metric: "", metricLabel: "" },
  { company: "", industry: "", challenge: "", outcome: "", metric: "", metricLabel: "" },
];

export function CaseStudiesSection() {
  const { t } = useTranslation();
  const { cms, cmsJson } = useLandingCms();

  const subtitle = cms("caseStudies.subtitle", t("caseStudiesSection.subtitle"));
  const title = cms("caseStudies.title", t("caseStudiesSection.title"));
  const seeAllLabel = cms("caseStudies.seeAllLabel", t("caseStudiesSection.seeAll"));
  const seeAllHref = cms("caseStudies.seeAllHref", "/case-studies");
  const challengeLabel = cms("caseStudies.challengeLabel", t("caseStudiesSection.challenge"));
  const outcomeLabel = cms("caseStudies.outcomeLabel", t("caseStudiesSection.outcome"));
  const cases = cmsJson("caseStudies.items", DEFAULT_ITEMS);

  if (cases.length === 0) return null;

  return (
    <section className="bg-surface-warm/40 py-20 sm:py-28">
      <div className="container-page">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{subtitle}</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl lg:text-5xl">{title}</h2>
          </div>
          <Link to={seeAllHref} className="group inline-flex items-center gap-2 text-sm font-semibold text-ink">
            {seeAllLabel} <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {cases.map((c, i) => (
            <motion.article
              key={`${c.company}-${i}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="flex flex-col rounded-3xl border border-border bg-card p-7 shadow-soft"
            >
              <span className="inline-flex w-fit items-center rounded-full bg-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {c.industry}
              </span>
              <h3 className="mt-4 font-display text-lg font-bold text-ink">{c.company}</h3>
              <p className="mt-3 text-sm text-muted-foreground">
                <span className="font-semibold text-ink">{challengeLabel}.</span> {c.challenge}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-semibold text-ink">{outcomeLabel}.</span> {c.outcome}
              </p>
              <div className="mt-auto pt-6">
                <div className="flex items-end justify-between rounded-2xl bg-primary-soft px-4 py-3">
                  <div>
                    <p className="font-display text-2xl font-bold text-ink">{c.metric}</p>
                    <p className="text-[11px] text-muted-foreground">{c.metricLabel}</p>
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-primary" />
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
