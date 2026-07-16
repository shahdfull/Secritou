import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { useLandingCms } from "@/providers/LandingCmsProvider";
import { resolveIcon } from "../cms/iconRegistry";

type ProblemItem = { icon: string; title: string; body: string };

const DEFAULT_ITEMS: ProblemItem[] = [
  { icon: "eye-off", title: "", body: "" },
  { icon: "workflow", title: "", body: "" },
  { icon: "globe", title: "", body: "" },
  { icon: "hourglass", title: "", body: "" },
];

export function Problems() {
  const { t } = useTranslation();
  const { cms, cmsJson } = useLandingCms();

  const subtitle = cms("problems.subtitle", t("home.problems.subtitle"));
  const title = cms("problems.title", t("home.problems.title"));
  const description = cms("problems.description", t("home.problems.description"));
  const items = cmsJson("problems.items", DEFAULT_ITEMS);

  if (items.length === 0) return null;

  return (
    <section className="bg-background py-14 sm:py-20">
      <div className="container-page">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{subtitle}</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl lg:text-5xl">{title}</h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">{description}</p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((p, i) => {
            const Icon = resolveIcon(p.icon);
            return (
              <motion.div
                key={`${p.title}-${i}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                className="rounded-2xl border border-border bg-card p-6 shadow-soft"
              >
                <div className="flex gap-4">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-ink">
                    {Icon && <Icon className="h-5 w-5" />}
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-semibold text-ink">{p.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
