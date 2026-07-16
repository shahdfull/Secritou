import { siteContentRepository, type SiteContentUpsert } from "../repositories/siteContent.repository.js";
import { HttpError } from "../utils/httpError.js";

const VALID_LOCALES = new Set(["fr", "en"]);

function resolveLocale(raw: unknown): string {
  if (typeof raw === "string" && VALID_LOCALES.has(raw)) return raw;
  return "fr";
}

type BilingualListItem = Record<string, unknown> & {
  fr?: Record<string, unknown>;
  en?: Record<string, unknown>;
};

/**
 * A bilingual list field's stored value is `[{ fr: {...}, en: {...}, _enEdited }, ...]`
 * — one object per item, both languages at the same array position, so
 * reordering/adding/removing an item can never desync fr from en. Public
 * consumers (the landing page) only need the current language's shape,
 * so this flattens `[{fr, en}]` down to `[{...fr fields}]` at read time.
 */
function extractLocaleFromList(rawValue: string, locale: string): string {
  try {
    const items = JSON.parse(rawValue) as BilingualListItem[];
    if (!Array.isArray(items)) return rawValue;
    const flattened = items.map((item) => (locale === "en" ? item.en ?? item.fr ?? {} : item.fr ?? {}));
    return JSON.stringify(flattened);
  } catch {
    return rawValue;
  }
}

export class SiteContentService {
  /** Returns flat key→value map for the requested locale. Falls back to "fr". */
  async getFlat(localeRaw: unknown): Promise<Record<string, string>> {
    const locale = resolveLocale(localeRaw);
    const [rows, bilingualRows] = await Promise.all([
      siteContentRepository.findByLocale(locale),
      siteContentRepository.findAllLocaleRows(),
    ]);

    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    for (const r of bilingualRows) {
      map[r.key] = r.type === "JSON" ? extractLocaleFromList(r.value, locale) : r.value;
    }
    return map;
  }

  /**
   * Returns rows grouped by section for admin editing. Bilingual (locale
   * "all") rows are returned as-is — full {fr, en} structure per item — so
   * the editor can show both languages side by side instead of the admin
   * having to switch a locale toggle to see/edit English.
   */
  async getGrouped(localeRaw: unknown) {
    const locale = resolveLocale(localeRaw);
    return siteContentRepository.findGroupedByLocale(locale);
  }

  /**
   * Upsert a single key+value pair. ADMIN only. Resolves the row's actual
   * locale by key (not by the caller's requested locale) — a bilingual list
   * field lives under locale "all" regardless of which UI language tab the
   * admin has open, since editing it edits both languages' data at once.
   */
  async upsertOne(key: string, locale: string, value: string) {
    const existing = await siteContentRepository.findByKeyAnyLocale(key);

    if (!existing) {
      throw new HttpError(404, `Key "${key}" not found. Seed it first.`);
    }

    const targetLocale = existing.locale === "all" ? "all" : resolveLocale(locale);

    return siteContentRepository.upsertOne({
      key,
      locale: targetLocale,
      value,
      type: existing.type,
      section: existing.section,
      label: existing.label,
    });
  }
}

export const siteContentService = new SiteContentService();
