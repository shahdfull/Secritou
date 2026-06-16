import { BarChart3, Rocket, Monitor, Sparkles, ArrowRight } from "lucide-react";
import { FinalCTA } from "@/features/landing/components/FinalCTA";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const services = [
  {
    icon: BarChart3,
    title: "Business Performance",
    body: "Turn scattered numbers into one source of truth and turn that truth into decisions.",
    capabilities: [
      "KPI architecture & tracking",
      "Executive dashboards",
      "Quarterly objectives (OKRs)",
      "Business analytics & reporting",
      "Financial insights",
      "Performance reviews",
    ],
  },
  {
    icon: Rocket,
    title: "Digital Growth",
    body: "A coordinated growth engine content, SEO, social and paid working as one system, not silos.",
    capabilities: [
      "Organic social strategy",
      "Content production",
      "Technical & on-page SEO",
      "Paid acquisition (Meta, Google)",
      "Email & lifecycle marketing",
      "Brand positioning",
    ],
  },
  {
    icon: Monitor,
    title: "Technology Solutions",
    body: "The digital infrastructure your business needs to operate at the next level.",
    capabilities: [
      "Marketing & product websites",
      "E-commerce platforms",
      "Inventory & ops systems",
      "Internal tools",
      "Integrations & APIs",
      "Hosting & performance",
    ],
  },
  {
    icon: Sparkles,
    title: "AI & Automation",
    body: "Compress hours of busywork into seconds and free your team for work that actually matters.",
    capabilities: [
      "AI chatbots & assistants",
      "Workflow automation",
      "Lead enrichment & routing",
      "Document & data extraction",
      "Process optimization",
      "Custom AI integrations",
    ],
  },
];

export function ServicesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

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
            Everything your growth needs under one roof.
          </h1>
          <p className="mt-5 text-base text-muted-foreground sm:text-lg">
            We organize our work around four practices. Pick one, mix several, or engage us as
            your end-to-end growth partner.
          </p>
        </div>
      </section>

      <section className="bg-background pb-24">
        <div className="container-page space-y-6">
          {services.map((s, i) => (
            <article
              key={s.title}
              className="grid gap-8 rounded-3xl border border-border bg-card p-8 shadow-soft lg:grid-cols-[1fr_2fr] lg:p-10"
            >
              <div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
                  <s.icon className="h-5 w-5" />
                </div>
                <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  0{i + 1}
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold text-ink">{s.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                <button
                  onClick={() => handleContactClick(s.title)}
                  className="group mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
                >
                  {t("nav.bookConsultation")}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {s.capabilities.map((c) => (
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
          ))}
        </div>
      </section>

      <FinalCTA />
    </>
  );
}
