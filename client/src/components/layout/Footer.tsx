import { Link } from "react-router-dom";
import { Linkedin, Twitter, Instagram, Mail } from "lucide-react";
import logoAsset from "@/assets/secritou-logo.png";
import { useTranslation } from "react-i18next";

export function Footer() {
  const { t } = useTranslation();

  const columns = [
    {
      titleKey: "home.footer.services",
      links: [
        { labelKey: "services.businessPerformance.title", to: "/services" },
        { labelKey: "services.digitalGrowth.title", to: "/services" },
        { labelKey: "services.technologySolutions.title", to: "/services" },
        { labelKey: "services.aiAutomation.title", to: "/services" },
      ],
    },
    {
      titleKey: "home.footer.solutions",
      links: [
        { labelKey: "home.footer.forSmes", to: "/solutions" },
        { labelKey: "home.footer.forEntrepreneurs", to: "/solutions" },
        { labelKey: "home.footer.forCreators", to: "/solutions" },
      ],
    },
    {
      titleKey: "home.footer.industriesTitle",
      links: [
        { labelKey: "home.footer.industries.healthcare", to: "/solutions" },
        { labelKey: "home.footer.industries.education", to: "/solutions" },
        { labelKey: "home.footer.industries.professionalServices", to: "/solutions" },
        { labelKey: "home.footer.industries.retail", to: "/solutions" },
        { labelKey: "home.footer.industries.startups", to: "/solutions" },
      ],
    },
    {
      titleKey: "home.footer.company",
      links: [
        { labelKey: "nav.contact", to: "/contact" },
        { labelKey: "nav.joinUs", to: "/rejoindre" },
      ],
    },
  ];

  return (
    <footer className="border-t border-border bg-surface-warm/60">
      <div className="container-page py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2.6fr]">
          <div>
            <Link to="/" className="flex items-center gap-2">
              <img src={logoAsset} alt="" className="h-9 w-9 object-contain" loading="lazy" />
              <span className="font-display text-xl font-bold text-ink">Secritou</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              {t("home.footer.description")}
            </p>
            <div className="mt-6 flex gap-2">
              {[Linkedin, Twitter, Instagram, Mail].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="grid h-10 w-10 place-items-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-ink"
                  aria-label="Social link"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {columns.map((col) => (
              <div key={col.titleKey}>
                <h4 className="font-display text-sm font-semibold text-ink">{t(col.titleKey)}</h4>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l, i) => (
                    <li key={i}>
                      <Link
                        to={l.to}
                        className="text-sm text-muted-foreground transition-colors hover:text-ink"
                      >
                        {t(l.labelKey)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {t("home.footer.copyright", { year: new Date().getFullYear() })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("home.footer.builtFor")}
          </p>
        </div>
      </div>
    </footer>
  );
}
