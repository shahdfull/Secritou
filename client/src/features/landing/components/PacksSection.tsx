import { motion } from "motion/react";
import { Check, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLandingCms } from "@/providers/LandingCmsProvider";

type PackItem = {
  name: string;
  price: string;
  currency: string;
  period: string;
  description: string;
  features: string[];
};

export function PacksSection() {
  const { t } = useTranslation();
  const { cms, isLoading } = useLandingCms();

  const badge    = cms("packs.badge",    t("home.packs.badge"));
  const title    = cms("packs.title",    t("home.packs.title"));
  const subtitle = cms("packs.subtitle", t("home.packs.subtitle"));
  const ctaLabel = t("home.packs.cta");
  const popular  = t("home.packs.popular");

  const rawPacksResult = t("home.packs.items", { returnObjects: true });
  const rawPacks: PackItem[] = Array.isArray(rawPacksResult) ? rawPacksResult : [];

  // Merge CMS overrides per pack field
  const packs = rawPacks.map((pack, i) => ({
    name:        cms(`packs.items.${i}.name`,        pack.name),
    price:       cms(`packs.items.${i}.price`,       pack.price),
    currency:    pack.currency,
    period:      pack.period,
    description: cms(`packs.items.${i}.description`, pack.description),
    // CMS stores features as newline-separated string; parse it if present
    features: (() => {
      const cmsFeatures = cms(`packs.items.${i}.features`, "");
      if (cmsFeatures) return cmsFeatures.split("\n").filter(Boolean);
      return pack.features;
    })(),
    isPopular: i === 1,
  }));

  if (isLoading) {
    return (
      <section className="bg-background py-14 sm:py-20">
        <div className="container-page">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-muted mb-4" />
          <div className="h-12 w-80 animate-pulse rounded-lg bg-muted mb-3" />
          <div className="h-5 w-96 animate-pulse rounded-lg bg-muted mb-12" />
          <div className="grid gap-6 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-72 animate-pulse rounded-3xl bg-muted" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="packs" className="bg-background py-14 sm:py-20">
      <div className="container-page">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {badge}
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl lg:text-5xl">
            {title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {subtitle}
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {packs.map((pack, i) => (
            <motion.div
              key={pack.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`relative flex flex-col rounded-3xl border p-8 shadow-soft ${
                pack.isPopular
                  ? "border-primary bg-ink text-white"
                  : "border-border bg-card"
              }`}
            >
              {pack.isPopular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
                  {popular}
                </span>
              )}

              <div>
                <p className={`text-sm font-semibold ${pack.isPopular ? "text-white/70" : "text-muted-foreground"}`}>
                  {pack.name}
                </p>
                <p className={`mt-2 font-display text-4xl font-bold ${pack.isPopular ? "text-white" : "text-ink"}`}>
                  {pack.price}
                  {pack.currency && (
                    <span className="ml-1 text-base font-medium">{pack.currency}</span>
                  )}
                </p>
                {pack.period && (
                  <p className={`text-xs ${pack.isPopular ? "text-white/60" : "text-muted-foreground"}`}>
                    {pack.period}
                  </p>
                )}
                <p className={`mt-3 text-sm leading-relaxed ${pack.isPopular ? "text-white/80" : "text-muted-foreground"}`}>
                  {pack.description}
                </p>
              </div>

              <ul className="mt-6 flex-1 space-y-2.5">
                {pack.features.map((feature) => (
                  <li key={feature} className={`flex items-start gap-2.5 text-sm ${pack.isPopular ? "text-white/90" : "text-ink"}`}>
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${pack.isPopular ? "text-primary-foreground" : "text-primary"}`} />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                to="/contact"
                className={`group mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold transition-transform hover:-translate-y-0.5 ${
                  pack.isPopular
                    ? "bg-white text-ink shadow-soft"
                    : "border border-border bg-background text-ink hover:bg-surface"
                }`}
              >
                {ctaLabel}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
