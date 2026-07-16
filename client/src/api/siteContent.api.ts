import axios from "axios";

// Uses bare axios (no auth) so it works for unauthenticated visitors
const publicClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:5000/api/v1",
  timeout: 8000,
});

import apiClient from "./axios";

export type CmsLocale = "fr" | "en";

export type SiteContentItem = {
  id: string;
  key: string;
  locale: CmsLocale;
  value: string;
  type: "TEXT" | "RICHTEXT" | "IMAGE" | "BOOLEAN" | "JSON" | "SELECT";
  section: string;
  label: string;
};

export type SiteContentGrouped = Record<string, SiteContentItem[]>;

function normalizeLocale(lang: string): CmsLocale {
  if (lang.startsWith("en")) return "en";
  return "fr";
}

export const siteContentApi = {
  /** Public — no auth. Returns flat key→value map for the requested locale. */
  getPublic: async (lang: string): Promise<Record<string, string>> => {
    const locale = normalizeLocale(lang);
    const res = await publicClient.get<{ data: Record<string, string> }>("/site-content", {
      params: { locale },
    });
    return res.data.data;
  },

  /** Admin — grouped by section with metadata. Requires auth. */
  getGrouped: async (locale: CmsLocale): Promise<SiteContentGrouped> => {
    const res = await apiClient.get<{ data: SiteContentGrouped }>("/admin/site-content", {
      params: { locale },
    });
    return res.data.data;
  },

  /** Admin — upsert one key+locale. */
  upsertOne: async (key: string, locale: CmsLocale, value: string): Promise<void> => {
    await apiClient.put("/admin/site-content", { key, locale, value });
  },
};
