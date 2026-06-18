import { motion } from "motion/react";
import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";

export function SocialProof() {
  const { t } = useTranslation();

  const clients = [
    { name: "Acme Tech", initials: "AT" },
    { name: "Growth Hub", initials: "GH" },
    { name: "Digital Minds", initials: "DM" },
    { name: "Innovation Labs", initials: "IL" },
    { name: "Future Commerce", initials: "FC" },
    { name: "Smart Systems", initials: "SS" },
  ];

  return (
    <section className="relative border-t border-border bg-background py-12 lg:py-16">
      <div className="container-page">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="grid gap-12 lg:grid-cols-3"
        >
          {/* Clients */}
          <div className="flex flex-col items-start justify-center gap-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("socialProof.trustedBy")}
            </p>
            <div className="flex flex-wrap gap-2">
              {clients.map((client) => (
                <div
                  key={client.initials}
                  className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface text-xs font-semibold text-muted-foreground"
                  title={client.name}
                >
                  {client.initials}
                </div>
              ))}
            </div>
          </div>

          {/* Metric */}
          <div className="flex flex-col items-start justify-center gap-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("socialProof.impact")}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-4xl font-bold text-ink">+20–30%</span>
              <span className="text-sm text-muted-foreground">{t("socialProof.revenueGrowth")}</span>
            </div>
            <p className="text-xs text-muted-foreground">{t("socialProof.averageFirstYear")}</p>
          </div>

          {/* Testimonial */}
          <div className="flex flex-col items-start justify-center gap-3">
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className="h-4 w-4 fill-accent text-accent"
                  aria-hidden
                />
              ))}
            </div>
            <blockquote className="text-sm leading-relaxed text-ink">
              "{t("socialProof.testimonial")}"
            </blockquote>
            <div>
              <p className="text-xs font-semibold text-ink">{t("socialProof.testimonialAuthor")}</p>
              <p className="text-xs text-muted-foreground">{t("socialProof.testimonialRole")}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
