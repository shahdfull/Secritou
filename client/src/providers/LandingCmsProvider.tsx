import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import i18n from "@/i18n";
import { siteContentApi } from "@/api/siteContent.api";

type CmsMap = Record<string, string>;

type LandingCmsCtx = {
  cms: (key: string, fallback: string) => string;
  /**
   * Reads a SiteContent field of type JSON and parses it. Falls back to
   * `fallback` (not just on a missing key, but also on malformed/absent
   * JSON) so a bad edit in the admin CMS degrades to the built-in default
   * instead of crashing the section that reads it.
   */
  cmsJson: <T,>(key: string, fallback: T) => T;
  isLoading: boolean;
};

const LandingCmsContext = createContext<LandingCmsCtx>({
  cms: (_key, fallback) => fallback,
  cmsJson: (_key, fallback) => fallback,
  isLoading: false,
});

export function useLandingCms() {
  return useContext(LandingCmsContext);
}

export function LandingCmsProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<CmsMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetchForLang = useCallback((lang: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setIsLoading(true);
    siteContentApi
      .getPublic(lang)
      .then((map) => {
        if (!ctrl.signal.aborted) {
          setData(map);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setIsLoading(false);
      });
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchForLang(i18n.language);
    return () => abortRef.current?.abort();
  }, [fetchForLang]);

  // Re-fetch on language switch
  useEffect(() => {
    const handler = (lang: string) => fetchForLang(lang);
    i18n.on("languageChanged", handler);
    return () => i18n.off("languageChanged", handler);
  }, [fetchForLang]);

  const cms = useCallback(
    (key: string, fallback: string): string => data[key] ?? fallback,
    [data]
  );

  const cmsJson = useCallback(
    <T,>(key: string, fallback: T): T => {
      const raw = data[key];
      if (raw === undefined) return fallback;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },
    [data]
  );

  return (
    <LandingCmsContext.Provider value={{ cms, cmsJson, isLoading }}>
      {children}
    </LandingCmsContext.Provider>
  );
}
