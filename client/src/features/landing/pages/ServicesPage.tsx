import { BarChart3, Rocket, Monitor, Sparkles, ArrowRight } from "lucide-react";
import { FinalCTA } from "@/features/landing/components/FinalCTA";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

// `serviceType` is the canonical enum value sent to the backend (must match
// server/src/validators/contact.validator.ts). `titleKey` is only for display — never
// pass the translated title as the serviceType, it would fail contact-form validation.
const getServices = (t: any) => [
  {
    icon: BarChart3,
    serviceType: "Business Performance",
    titleKey: "services.businessPerformance.title",
    bodyKey: "services.businessPerformance.body",
    itemKeys: "services.businessPerformance.items",
  },
  {
    icon: Rocket,
    serviceType: "Digital Growth",
    titleKey: "services.digitalGrowth.title",
    bodyKey: "services.digitalGrowth.body",
    itemKeys: "services.digitalGrowth.items",
  },
  {
    icon: Monitor,
    serviceType: "Technology Solutions",
    titleKey: "services.technologySolutions.title",
    bodyKey: "services.technologySolutions.body",
    itemKeys: "services.technologySolutions.items",
  },
  {
    icon: Sparkles,
    serviceType: "AI & Automation",
    titleKey: "services.aiAutomation.title",
    bodyKey: "services.aiAutomation.body",
    itemKeys: "services.aiAutomation.items",
  },
];

export function ServicesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const services = getServices(t);

  const handleContactClick = (serviceType: string) => {
    navigate("/contact", { state: { selectedService: serviceType } });
  };

  return (
    <>
      <section className="bg-gradient-to-b from-surface-warm/70 to-background pt-20 pb-16 sm:pt-28">
        <div className="container-page max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t("nav.services")}
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold text-ink sm:text-5xl lg:text-6xl">
            {t("services.title")}
          </h1>
          <p className="mt-5 text-base text-muted-foreground sm:text-lg">
            {t("services.subtitle")}
          </p>
        </div>
      </section>

      <section className="bg-background pb-24">
        <div className="container-page space-y-6">
          {services.map((s, i) => {
            const title = t(s.titleKey);
            const body = t(s.bodyKey);
            const items = t(s.itemKeys);
            return (
              <article
                key={s.titleKey}
                className="grid gap-8 rounded-3xl border border-border bg-card p-8 shadow-soft lg:grid-cols-[1fr_2fr] lg:p-10"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
                      <s.icon className="h-5 w-5" />
                    </div>
                    <h2 className="font-display text-2xl font-bold text-ink">{title}</h2>
                  </div>
                  <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    0{i + 1}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
                  <button
                    onClick={() => handleContactClick(s.serviceType)}
                    className="group mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
                  >
                    {t("nav.bookConsultation")}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {Array.isArray(items) && items.map((c: string) => (
                    <li
                      key={c}
                      className="flex items-start gap-2.5 rounded-xl bg-surface-warm/40 px-4 py-3 text-sm text-ink"
                    >
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      {c}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <FinalCTA />
    </>
  );
}
