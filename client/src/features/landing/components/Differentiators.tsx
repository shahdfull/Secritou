import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { useLandingCms } from "@/providers/LandingCmsProvider";
import { resolveIcon } from "../cms/iconRegistry";

type DifferentiatorItem = { icon: string; title: string; body: string };

const DEFAULT_ITEMS: DifferentiatorItem[] = [
  { icon: "compass", title: "", body: "" },
  { icon: "line-chart", title: "", body: "" },
  { icon: "users", title: "", body: "" },
];

export function Differentiators() {
  const { t } = useTranslation();
  const { cms, cmsJson } = useLandingCms();

  const subtitle = cms("differentiators.subtitle", t("differentiators.subtitle"));
  const title = cms("differentiators.title", t("differentiators.title"));
  const items = cmsJson("differentiators.items", DEFAULT_ITEMS);

  if (items.length === 0) return null;

  return (
    <section className="bg-background py-14 sm:py-20">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{subtitle}</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl lg:text-5xl">{title}</h2>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {items.map((it, i) => {
            const Icon = resolveIcon(it.icon);
            return (
              <motion.div
                key={`${it.title}-${i}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="rounded-3xl border border-border bg-card p-8 shadow-soft"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ink text-white">
                    {Icon && <Icon className="h-5 w-5" />}
                  </div>
                  <h3 className="font-display text-xl font-bold text-ink">{it.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{it.body}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
