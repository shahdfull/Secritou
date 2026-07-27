import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const suggestedLinks = [
  { to: "/case-studies", labelKey: "nav.caseStudies" },
  { to: "/contact", labelKey: "nav.contact" },
  { to: "/rejoindre", labelKey: "nav.joinUs" },
];

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="font-display text-8xl font-bold text-primary">404</h1>
      <h2 className="mt-4 font-display text-3xl font-bold text-ink">{t("notFound.title")}</h2>
      <p className="mt-2 text-muted-foreground">{t("notFound.description")}</p>
      <Link
        to="/"
        className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-ink px-6 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5"
      >
        {t("notFound.goHome")}
      </Link>
      <div className="mt-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("notFound.suggestions")}
        </p>
        <nav className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {suggestedLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-sm font-medium text-ink underline-offset-4 hover:underline"
            >
              {t(link.labelKey)}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
