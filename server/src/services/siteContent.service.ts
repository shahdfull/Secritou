import { siteContentRepository, type SiteContentUpsert } from "../repositories/siteContent.repository.js";
import { HttpError } from "../utils/httpError.js";

const VALID_LOCALES = new Set(["fr", "en"]);

function resolveLocale(raw: unknown): string {
  if (typeof raw === "string" && VALID_LOCALES.has(raw)) return raw;
  return "fr";
}

export class SiteContentService {
  /** Returns flat key→value map for the requested locale. Falls back to "fr". */
  async getFlat(localeRaw: unknown): Promise<Record<string, string>> {
    const locale = resolveLocale(localeRaw);
    const rows = await siteContentRepository.findByLocale(locale);
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return map;
  }

  /** Returns rows grouped by section for admin editing. */
  async getGrouped(localeRaw: unknown) {
    const locale = resolveLocale(localeRaw);
    return siteContentRepository.findGroupedByLocale(locale);
  }

  /** Upsert a single key+locale pair. ADMIN only. */
  async upsertOne(key: string, locale: string, value: string) {
    const resolvedLocale = resolveLocale(locale);
    // Find the existing row to preserve section/label/type
    const existing = await siteContentRepository
      .findByLocale(resolvedLocale)
      .then((rows) => rows.find((r) => r.key === key));

    if (!existing) {
      throw new HttpError(404, `Key "${key}" not found for locale "${resolvedLocale}". Seed it first.`);
    }

    return siteContentRepository.upsertOne({
      key,
      locale: resolvedLocale,
      value,
      type: existing.type,
      section: existing.section,
      label: existing.label,
    });
  }
}

export const siteContentService = new SiteContentService();
