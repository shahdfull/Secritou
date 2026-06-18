import { Link, NavLink } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import logoAsset from "@/assets/secritou-logo.png";

export function Header() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const nav = [
    { to: "/services", label: t("nav.services") },
    { to: "/solutions", label: t("nav.solutions") },
    { to: "/contact", label: t("nav.contact") },
    { to: "/rejoindre", label: t("nav.joinUs") },
  ] as const;

  // Close menu when pressing Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    if (open) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="Secritou home">
          <img src={logoAsset} alt="" className="h-11 w-11 object-contain" loading="lazy" />
          <span className="font-display text-lg font-bold tracking-tight text-ink">
            Secritou
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive
                  ? "px-3 py-2 text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-full"
                  : "px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-full"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => i18n.changeLanguage("fr")}
            className={`text-sm transition-colors ${
              i18n.language === "fr"
                ? "font-semibold text-ink"
                : "font-medium text-muted-foreground hover:text-ink"
            }`}
          >
            FR
          </button>
          <span className="text-muted-foreground">|</span>
          <button
            onClick={() => i18n.changeLanguage("en")}
            className={`text-sm transition-colors ${
              i18n.language === "en"
                ? "font-semibold text-ink"
                : "font-medium text-muted-foreground hover:text-ink"
            }`}
          >
            EN
          </button>
          <Link
            to="/contact"
            className="ml-4 inline-flex items-center rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink/90"
          >
            {t("nav.scheduleCall")}
          </Link>
        </div>

        <button
          ref={buttonRef}
          type="button"
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          aria-label="Toggle menu"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div
          id="mobile-menu"
          ref={menuRef}
          className="md:hidden border-t border-border bg-background"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
        >
          <div className="container-page py-4 flex flex-col gap-1">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="py-2.5 text-base font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="py-2.5 text-base font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
            >
              {t("auth.signIn")}
            </Link>
            <Link
              to="/contact"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center justify-center rounded-full bg-ink px-4 py-2.5 text-base font-semibold text-white transition-colors hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {t("nav.scheduleCall")}
            </Link>
            <div className="pt-4 mt-2 border-t border-border flex items-center justify-center gap-3">
              <button
                onClick={() => i18n.changeLanguage("fr")}
                className={`text-sm transition-colors ${
                  i18n.language === "fr"
                    ? "font-semibold text-ink"
                    : "font-medium text-muted-foreground hover:text-ink"
                }`}
              >
                FR
              </button>
              <span className="text-muted-foreground">|</span>
              <button
                onClick={() => i18n.changeLanguage("en")}
                className={`text-sm transition-colors ${
                  i18n.language === "en"
                    ? "font-semibold text-ink"
                    : "font-medium text-muted-foreground hover:text-ink"
                }`}
              >
                EN
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
