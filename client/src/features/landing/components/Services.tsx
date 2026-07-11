import { motion } from "motion/react";
import { BarChart3, Rocket, Monitor, Sparkles, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { trackServiceCardClicked } from "@/services/analytics.service";
import { useTranslation } from "react-i18next";
import { useLandingCms } from "@/providers/LandingCmsProvider";

// `serviceType` is the canonical enum value sent to the backend (must match
// server/src/validators/contact.validator.ts). It never changes with the CMS/i18n title.
export function Services() {
  const { t } = useTranslation();
  const { cms } = useLandingCms();
  const navigate = useNavigate();

  const services = [
    {
      icon: BarChart3,
      serviceType: "Business Performance",
      title: cms("services.items.0.title", t("home.services.items.0.title")),
      body:  cms("services.items.0.body",  t("home.services.items.0.body")),
      items: [
        t("home.services.items.0.items.0"),
        t("home.services.items.0.items.1"),
        t("home.services.items.0.items.2"),
        t("home.services.items.0.items.3"),
      ],
    },
    {
      icon: Rocket,
      serviceType: "Digital Growth",
      title: cms("services.items.1.title", t("home.services.items.1.title")),
      body:  cms("services.items.1.body",  t("home.services.items.1.body")),
      items: [
        t("home.services.items.1.items.0"),
        t("home.services.items.1.items.1"),
        t("home.services.items.1.items.2"),
        t("home.services.items.1.items.3"),
      ],
    },
    {
      icon: Monitor,
      serviceType: "Technology Solutions",
      title: cms("services.items.2.title", t("home.services.items.2.title")),
      body:  cms("services.items.2.body",  t("home.services.items.2.body")),
      items: [
        t("home.services.items.2.items.0"),
        t("home.services.items.2.items.1"),
        t("home.services.items.2.items.2"),
        t("home.services.items.2.items.3"),
      ],
    },
    {
      icon: Sparkles,
      serviceType: "AI & Automation",
      title: cms("services.items.3.title", t("home.services.items.3.title")),
      body:  cms("services.items.3.body",  t("home.services.items.3.body")),
      items: [
        t("home.services.items.3.items.0"),
        t("home.services.items.3.items.1"),
        t("home.services.items.3.items.2"),
        t("home.services.items.3.items.3"),
      ],
    },
  ];

  const handleContactClick = (serviceType: string, title: string) => {
    trackServiceCardClicked({ service: title });
    navigate("/contact", { state: { selectedService: serviceType } });
  };

  return (
    <section id="services" className="bg-surface-warm/40 py-14 sm:py-20">
      <div className="container-page">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {cms("services.subtitle", t("home.services.subtitle"))}
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl lg:text-5xl">
            {cms("services.title", t("home.services.title"))}
          </h2>
        </div>

        <div className="mt-12 grid gap-4 grid-cols-1 md:grid-cols-2">
          {services.map((s, i) => (
            <motion.button
              key={s.title}
              type="button"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              onClick={() => handleContactClick(s.serviceType, s.title)}
              className="group relative overflow-hidden rounded-3xl border border-border bg-card p-7 shadow-soft transition-shadow hover:shadow-card text-left w-full"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-ink">{s.title}</h3>
                </div>
                <span className="text-xs font-semibold text-muted-foreground">0{i + 1}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              <ul className="mt-5 grid grid-cols-2 gap-y-2 gap-x-3 text-xs text-ink">
                {s.items.map((it) => (
                  <li key={it} className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {it}
                  </li>
                ))}
              </ul>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                {t("nav.bookConsultation")}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
}
