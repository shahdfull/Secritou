import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLandingCms } from "@/providers/LandingCmsProvider";
import { resolveIcon } from "../cms/iconRegistry";

type SegmentItem = { icon: string; tag: string; title: string; needs: string[]; linkHref?: string };

const DEFAULT_ITEMS: SegmentItem[] = [
  { icon: "building", tag: "", title: "", needs: ["", "", ""], linkHref: "/contact" },
  { icon: "compass", tag: "", title: "", needs: ["", "", ""], linkHref: "/contact" },
  { icon: "store", tag: "", title: "", needs: ["", "", ""], linkHref: "/contact" },
];

export function SolutionsTeaser() {
  const { t } = useTranslation();
  const { cms, cmsJson } = useLandingCms();

  const subtitle = cms("solutions.subtitle", t("solutionsTeaser.subtitle"));
  const title = cms("solutions.title", t("solutionsTeaser.title"));
  const exploreLabel = cms("solutions.exploreLabel", t("solutionsTeaser.explore"));
  const segments = cmsJson("solutions.items", DEFAULT_ITEMS);

  if (segments.length === 0) return null;

  return (
    <section id="solutions" className="bg-surface-warm/40 py-14 sm:py-20">
      <div className="container-page">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{subtitle}</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl lg:text-5xl">{title}</h2>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {segments.map((s, i) => {
            const Icon = resolveIcon(s.icon);
            return (
              <motion.div
                key={`${s.tag}-${i}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="rounded-3xl border border-border bg-card p-7 shadow-soft"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-ink">
                    {Icon && <Icon className="h-5 w-5" />}
                  </div>
                  <p className="font-display text-xl font-bold uppercase text-ink">{s.tag}</p>
                </div>
                <h3 className="mt-5 text-xs font-semibold tracking-wider text-primary">{s.title}</h3>
                {s.needs.length > 0 && (
                  <ul className="mt-5 space-y-2 text-sm text-ink">
                    {s.needs.map((need, j) => (
                      <li key={j} className="flex items-center gap-2">
                        <span className="grid h-4 w-4 place-items-center rounded-full bg-primary text-[9px] text-primary-foreground">
                          ✓
                        </span>
                        {need}
                      </li>
                    ))}
                  </ul>
                )}
                {s.linkHref && (
                  <Link
                    to={s.linkHref}
                    className="mt-7 inline-flex items-center gap-1.5 text-sm font-semibold text-ink hover:text-primary"
                  >
                    {exploreLabel} <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
