import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import resourcesToBackend from "i18next-resources-to-backend";
import frTranslation from "./locales/fr/translation.json";

// FR (primary + fallback language) is bundled statically so the majority of
// visitors get synchronous rendering with zero extra request. Other languages
// (EN) are code-split by Vite and fetched on demand, keeping ~10 KB gzip of
// English strings out of the entry chunk.
i18n
  .use(
    resourcesToBackend((lng: string) => import(`./locales/${lng}/translation.json`))
  )
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: {
        translation: frTranslation,
      },
    },
    partialBundledLanguages: true,
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
    react: {
      // Without suspense, components outside route boundaries (Header/Footer)
      // render FR fallbacks for the instant it takes to load a lazy language,
      // instead of throwing to the nearest Suspense.
      useSuspense: false,
    },
  });

i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng.split("-")[0];
});

if (typeof document !== "undefined") {
  document.documentElement.lang = (i18n.resolvedLanguage ?? i18n.language ?? "fr").split("-")[0];
}

export default i18n;
