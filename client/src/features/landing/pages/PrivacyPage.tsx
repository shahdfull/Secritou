import { useTranslation } from "react-i18next";

export function PrivacyPage() {
  const { t } = useTranslation();
  return (
    <>
      <section className="bg-gradient-to-b from-surface-warm/70 to-background pt-20 pb-10 sm:pt-28">
        <div className="container-page max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t("privacyPage.brand")}</p>
          <h1 className="mt-3 font-display text-4xl font-bold text-ink sm:text-5xl">
            {t("privacyPage.title")}
          </h1>
        </div>
      </section>

      <section className="bg-background pb-24">
        <div className="container-page max-w-3xl prose prose-neutral prose-sm sm:prose-base">
          <p className="text-muted-foreground text-sm">{t("privacyPage.lastUpdated")}</p>

          <h2>{t("privacyPage.whoWeAreTitle")}</h2>
          <p>{t("privacyPage.whoWeAreBody")}</p>

          <h2>{t("privacyPage.dataCollectedTitle")}</h2>
          <p>{t("privacyPage.dataCollectedIntro")}</p>
          <ul>
            <li>{t("privacyPage.dataCollectedContact")}</li>
            <li>
              {t("privacyPage.dataCollectedAnalytics")}
            </li>
          </ul>
          <p>{t("privacyPage.noSensitiveData")}</p>

          <h2>{t("privacyPage.purposeTitle")}</h2>
          <ul>
            <li>{t("privacyPage.purposeContact")}</li>
            <li>{t("privacyPage.purposeImprove")}</li>
          </ul>

          <h2>{t("privacyPage.retentionTitle")}</h2>
          <p>{t("privacyPage.retentionBody")}</p>

          <h2>{t("privacyPage.rightsTitle")}</h2>
          <p>
            {t("privacyPage.rightsBody")}{" "}
            <a href="mailto:contact@secritou.tn">contact@secritou.tn</a>.
          </p>

          <h2>{t("privacyPage.cookiesTitle")}</h2>
          <p>{t("privacyPage.cookiesBody")}</p>

          <h2>{t("privacyPage.contactTitle")}</h2>
          <p>
            {t("privacyPage.contactBody")}{" "}
            <a href="mailto:contact@secritou.tn">contact@secritou.tn</a>
          </p>
        </div>
      </section>
    </>
  );
}
