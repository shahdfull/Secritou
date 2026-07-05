import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import enTranslation from "./locales/en/translation.json";
import frTranslation from "./locales/fr/translation.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslation,
      },
      fr: {
        translation: frTranslation,
      },
    },
    fallbackLng: "fr",
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "lang",
    },
  });

i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng.split("-")[0];
});

if (typeof document !== "undefined") {
  document.documentElement.lang = (i18n.resolvedLanguage ?? i18n.language ?? "fr").split("-")[0];
}

export default i18n;
