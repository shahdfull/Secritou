/**
 * Centralized formatting helpers. Use these instead of inline Intl.* / toLocale*
 * calls so currency, dates and percentages stay consistent across the app.
 *
 * Default locale is fr-FR (matching the formatting already used across the app)
 * and default currency is TND, matching the Secritou business context. All helpers
 * degrade gracefully to "—" on null/undefined/invalid input rather than throwing.
 */

const FALLBACK = "—";

/**
 * Format a monetary amount, e.g. formatCurrency(1234.5) → "1 234,500 TND".
 * @param amount   The numeric amount. null/undefined/NaN → "—".
 * @param currency ISO currency code (default "TND").
 * @param locale   BCP-47 locale (default "fr-TN").
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency = "TND",
  locale = "fr-FR",
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return FALLBACK;
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

/**
 * Format a date with consistent defaults (day/month/year).
 * @param date    Date object or parseable string. null/undefined/invalid → "—".
 * @param options Intl.DateTimeFormatOptions to override the defaults.
 * @param locale  BCP-47 locale (default "fr-TN").
 */
export function formatDate(
  date: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  locale = "fr-FR",
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
    return new Intl.DateTimeFormat(locale, opts).format(d);
  } catch {
    return FALLBACK;
  }
}

/**
 * Format a date as a relative string, e.g. "il y a 2 jours" / "dans 3 heures".
 * @param date   Date object or parseable string. null/undefined/invalid → "—".
 * @param locale BCP-47 locale (default "fr-TN").
 */
export function formatRelativeDate(
  date: Date | string | null | undefined,
  locale = "fr-FR",
): string {
  if (date === null || date === undefined) return FALLBACK;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return FALLBACK;

  const diffMs = d.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
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
 * @param locale   BCP-47 locale (default "fr-TN").
 */
export function formatPercent(
  value: number | null | undefined,
  decimals = 1,
  locale = "fr-FR",
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return FALLBACK;
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value) + " %";
  } catch {
    return `${value.toFixed(decimals)} %`;
  }
}
