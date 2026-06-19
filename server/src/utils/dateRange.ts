/**
 * Timezone-aware date-range helpers.
 *
 * DB timestamps are stored as UTC (Timestamptz). Period boundaries ("start of this month",
 * etc.) must be computed in the *business* timezone, otherwise records near a month/day edge
 * are miscounted by the server↔business UTC offset.
 *
 * Default business timezone is Africa/Tunis: the platform's live data is invoiced in TND
 * (Tunisian Dinar), so Tunisia is the operating market. Override via the BUSINESS_TIMEZONE
 * env var if the deployment serves a different region.
 */
export const BUSINESS_TIMEZONE = process.env.BUSINESS_TIMEZONE ?? "Africa/Tunis";

/**
 * Returns the UTC Date corresponding to the first instant of the current month *in the business
 * timezone*. e.g. for Africa/Tunis (UTC+1) the 1st at 00:00 local is the previous day 23:00 UTC.
 */
export function startOfBusinessMonth(now: Date = new Date(), timeZone: string = BUSINESS_TIMEZONE): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const year = get("year");
  const month = get("month"); // 1-12

  // Offset (minutes) between business-local wall clock and UTC for `now`.
  const localAsUtc = Date.UTC(
    year,
    month - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second")
  );
  const offsetMinutes = Math.round((localAsUtc - now.getTime()) / 60000);

  // First instant of the local month, expressed in UTC.
  const localMonthStartAsUtc = Date.UTC(year, month - 1, 1, 0, 0, 0);
  return new Date(localMonthStartAsUtc - offsetMinutes * 60000);
}
