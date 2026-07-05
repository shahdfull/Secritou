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
  isLoading: boolean;
};

const LandingCmsContext = createContext<LandingCmsCtx>({
  cms: (_key, fallback) => fallback,
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

  return (
    <LandingCmsContext.Provider value={{ cms, isLoading }}>
      {children}
    </LandingCmsContext.Provider>
  );
}
