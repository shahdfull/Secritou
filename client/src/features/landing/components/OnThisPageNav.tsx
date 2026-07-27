import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const SECTIONS = [
  { id: "services", labelKey: "home.onThisPage.services" },
  { id: "packs", labelKey: "home.onThisPage.packs" },
  { id: "solutions", labelKey: "home.onThisPage.solutions" },
  { id: "how-it-works", labelKey: "home.onThisPage.howItWorks" },
  { id: "faq", labelKey: "home.onThisPage.faq" },
] as const;

// Sticky in-page nav for the long HomePage scroll. Mirrors the scroll-spy
// pattern already used in Header for /#services and /#solutions.
export function OnThisPageNav() {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    const elements = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <nav aria-label={t("home.onThisPage.label")}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("home.onThisPage.label")}
      </p>
      <ul className="flex flex-col gap-2 border-l border-border pl-4">
        {SECTIONS.map((section) => {
          const isActive = activeSection === section.id;
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth" });
                }}
                className={
                  isActive
                    ? "text-sm font-semibold text-ink"
                    : "text-sm font-medium text-muted-foreground transition-colors hover:text-ink"
                }
              >
                {t(section.labelKey)}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
