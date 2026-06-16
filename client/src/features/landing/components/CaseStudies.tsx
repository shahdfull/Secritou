import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";

export const cases = [
  {
    industry: "Retail",
    company: "Nordic Bistro Group",
    challenge: "Disconnected ops across 4 locations and no real-time revenue view.",
    outcome: "Unified KPI dashboard, automated reporting, and a digital-first menu strategy.",
    metric: "+34%",
    metricLabel: "Revenue in 6 months",
  },
  {
    industry: "Professional Services",
    company: "Atlas Studio",
    challenge: "Strong portfolio, weak inbound � relying entirely on word of mouth.",
    outcome: "SEO foundation, content engine and paid acquisition tuned to high-intent buyers.",
    metric: "3.8×",
    metricLabel: "Qualified leads / month",
  },
  {
    industry: "Creator Economy",
    company: "Helix Labs",
    challenge: "Audience of 180k but revenue plateauing on a single sponsorship channel.",
    outcome: "Productized offers, automated funnels, and a creator-first analytics stack.",
    metric: "+€42k",
    metricLabel: "New MRR in 90 days",
  },
];

export function CaseStudiesSection() {
  return (
    <section className="bg-surface-warm/40 py-20 sm:py-28">
      <div className="container-page">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Case studies
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl lg:text-5xl">
              Results, not retainers.
            </h2>
          </div>
          <Link
            to="/case-studies"
            className="group inline-flex items-center gap-2 text-sm font-semibold text-ink"
          >
            All case studies <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {cases.map((c, i) => (
            <motion.article
              key={c.company}
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
                <span className="font-semibold text-ink">Challenge.</span> {c.challenge}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-semibold text-ink">Outcome.</span> {c.outcome}
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
