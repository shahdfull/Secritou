/**
 * Centralized formatting helpers. Use these instead of inline Intl.* / toLocale*
 * calls so currency, dates and percentages stay consistent across the app.
 *
 * Locale is derived from the active i18n language at call time, defaulting to
 * fr-FR to match the app's primary language. All helpers degrade gracefully to
 * "—" on null/undefined/invalid input rather than throwing.
 */

import i18n from "@/i18n";

const FALLBACK = "—";

function getLocale(): string {
  const lang = i18n.resolvedLanguage ?? i18n.language ?? "fr";
  return lang.startsWith("en") ? "en-GB" : "fr-FR";
}

/**
 * Format a monetary amount, e.g. formatCurrency(1234.5) → "1 234,500 TND".
 * @param amount   The numeric amount. null/undefined/NaN → "—".
 * @param currency ISO currency code (default "TND").
 * @param locale   BCP-47 locale (defaults to active i18n language).
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency = "TND",
  locale?: string,
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return FALLBACK;
  try {
    return new Intl.NumberFormat(locale ?? getLocale(), { style: "currency", currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

/**
 * Format a date with consistent defaults (day/month/year).
 * @param date    Date object or parseable string. null/undefined/invalid → "—".
 * @param options Intl.DateTimeFormatOptions to override the defaults.
 * @param locale  BCP-47 locale (defaults to active i18n language).
 */
export function formatDate(
  date: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  locale?: string,
): string {
  if (date === null || date === undefined) return FALLBACK;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return FALLBACK;
  const opts: Intl.DateTimeFormatOptions = options ?? {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  };
  try {
    return new Intl.DateTimeFormat(locale ?? getLocale(), opts).format(d);
  } catch {
    return FALLBACK;
  }
}

/**
 * Format a plain number with locale grouping (no currency symbol), e.g.
 * formatNumber(1234.5) → "1 234,5". Use this for values rendered next to a
 * manual unit suffix (e.g. `${formatNumber(x)} TND`).
 * @param value   The number. null/undefined/NaN → "—".
 * @param options Intl.NumberFormatOptions to override defaults.
 * @param locale  BCP-47 locale (defaults to active i18n language).
 */
export function formatNumber(
  value: number | null | undefined,
  options?: Intl.NumberFormatOptions,
  locale?: string,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return FALLBACK;
  try {
    return new Intl.NumberFormat(locale ?? getLocale(), options).format(value);
  } catch {
    return String(value);
  }
}

/**
 * Format a date with both date and time parts, e.g. formatDateTime(x) →
 * "04/07/2026 14:30". null/undefined/invalid → "—".
 * @param date   Date object or parseable string.
 * @param locale BCP-47 locale (defaults to active i18n language).
 */
export function formatDateTime(
  date: Date | string | null | undefined,
  locale?: string,
): string {
  return formatDate(
    date,
    { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" },
    locale,
  );
}

/**
 * Format a date as a relative string, e.g. "il y a 2 jours" / "2 days ago".
 * @param date   Date object or parseable string. null/undefined/invalid → "—".
 * @param locale BCP-47 locale (defaults to active i18n language).
 */
export function formatRelativeDate(
  date: Date | string | null | undefined,
  locale?: string,
): string {
  if (date === null || date === undefined) return FALLBACK;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return FALLBACK;

  const diffMs = d.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(locale ?? getLocale(), { numeric: "auto" });
  const divisions: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
    { amount: 60, unit: "second" },
    { amount: 60, unit: "minute" },
    { amount: 24, unit: "hour" },
    { amount: 7, unit: "day" },
    { amount: 4.34524, unit: "week" },
    { amount: 12, unit: "month" },
    { amount: Number.POSITIVE_INFINITY, unit: "year" },
  ];

  let duration = diffMs / 1000;
  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return FALLBACK;
}

/**
 * Format a number as a percentage string, e.g. formatPercent(15) → "15,0 %".
 * @param value    The percentage value (already 0-100, not a 0-1 fraction).
 * @param decimals Number of fraction digits (default 1). null/undefined/NaN → "—".
 * @param locale   BCP-47 locale (defaults to active i18n language).
 */
export function formatPercent(
  value: number | null | undefined,
  decimals = 1,
  locale?: string,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return FALLBACK;
  try {
    return new Intl.NumberFormat(locale ?? getLocale(), {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value) + " %";
  } catch {
    return `${value.toFixed(decimals)} %`;
  }
}
