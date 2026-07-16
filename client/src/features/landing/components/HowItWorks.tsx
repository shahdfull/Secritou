import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { useLandingCms } from "@/providers/LandingCmsProvider";

type Step = { title: string; body: string };

const DEFAULT_STEPS: Step[] = [
  { title: "", body: "" },
  { title: "", body: "" },
  { title: "", body: "" },
  { title: "", body: "" },
];

export function HowItWorks() {
  const { t } = useTranslation();
  const { cms, cmsJson } = useLandingCms();

  const subtitle = cms("howItWorks.subtitle", t("home.howItWorks.subtitle"));
  const title = cms("howItWorks.title", t("home.howItWorks.title"));
  const steps = cmsJson("howItWorks.steps", DEFAULT_STEPS);

  if (steps.length === 0) return null;

  return (
    <section className="bg-background py-14 sm:py-20">
      <div className="container-page">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{subtitle}</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl lg:text-5xl">{title}</h2>
        </div>

        <div className="mt-14">
          <div className="grid gap-8 lg:grid-cols-4 lg:gap-6">
            {steps.map((s, i) => (
              <motion.div
                key={`${s.title}-${i}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="relative"
              >
                <div className="flex items-center gap-3">
                  <div className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-ink font-display text-base font-bold text-white shadow-soft">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="font-display text-lg font-semibold text-ink">{s.title}</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
