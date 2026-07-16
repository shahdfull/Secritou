import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { useLandingCms } from "@/providers/LandingCmsProvider";
import { resolveIcon } from "../cms/iconRegistry";

type ImpactItem = { icon: string; title: string; description: string; metric: string; label: string };

const DEFAULT_ITEMS: ImpactItem[] = [
  { icon: "trending-up", title: "", description: "", metric: "", label: "" },
  { icon: "zap", title: "", description: "", metric: "", label: "" },
  { icon: "target", title: "", description: "", metric: "", label: "" },
  { icon: "bar-chart", title: "", description: "", metric: "", label: "" },
];

export function BusinessImpact() {
  const { t } = useTranslation();
  const { cms, cmsJson } = useLandingCms();

  const subtitle = cms("businessImpact.subtitle", t("businessImpact.subtitle"));
  const title = cms("businessImpact.title", t("businessImpact.title"));
  const description = cms("businessImpact.description", t("businessImpact.description"));
  const items = cmsJson("businessImpact.items", DEFAULT_ITEMS);

  if (items.length === 0) return null;

  return (
    <section className="bg-background py-20 sm:py-28">
      <div className="container-page">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{subtitle}</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl lg:text-5xl">{title}</h2>
          <p className="mt-5 text-base text-muted-foreground sm:text-lg">{description}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {items.map((item, index) => {
            const Icon = resolveIcon(item.icon);
            return (
              <motion.div
                key={`${item.title}-${index}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                className="rounded-3xl border border-border bg-card p-6 shadow-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
                      {Icon && <Icon className="h-6 w-6" />}
                    </div>
                    <h3 className="font-display text-lg font-bold text-ink">{item.title}</h3>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-xl font-bold text-primary">{item.metric}</p>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                  </div>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
