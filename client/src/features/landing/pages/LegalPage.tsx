import { useTranslation } from "react-i18next";

export function LegalPage() {
  const { t } = useTranslation();
  return (
    <>
      <section className="bg-gradient-to-b from-surface-warm/70 to-background pt-20 pb-10 sm:pt-28">
        <div className="container-page max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Secritou</p>
          <h1 className="mt-3 font-display text-4xl font-bold text-ink sm:text-5xl">
            {t("legalPage.title")}
          </h1>
        </div>
      </section>

      <section className="bg-background pb-24">
        <div className="container-page max-w-3xl prose prose-neutral prose-sm sm:prose-base">
          <h2>{t("legalPage.companySection")}</h2>
          <p>
            <strong>{t("legalPage.companyName")}</strong><br />
            {t("legalPage.companyDescription")}<br />
            {t("legalPage.companyLocation")}<br />
            {t("legalPage.companyEmail")} <a href="mailto:hello@secritou.com">hello@secritou.com</a><br />
            {t("legalPage.companyPhone")} <a href="tel:+21694243333">+216 94 243 333</a>
          </p>

          <h2>{t("legalPage.hostingSection")}</h2>
          <p>{t("legalPage.hostingText")}</p>

          <h2>{t("legalPage.ipSection")}</h2>
          <p>{t("legalPage.ipText")}</p>

          <h2>{t("legalPage.liabilitySection")}</h2>
          <p>{t("legalPage.liabilityText")}</p>

          <h2>{t("legalPage.lawSection")}</h2>
          <p>{t("legalPage.lawText")}</p>
        </div>
      </section>
    </>
  );
}
