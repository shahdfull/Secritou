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

/**
 * Returns the "YYYY-MM" key for `date` as it falls in the business timezone — sortable
 * chronologically as a plain string, unlike locale month labels (e.g. "Jul 2026").
 */
export function businessMonthKey(date: Date, timeZone: string = BUSINESS_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  return `${year}-${month}`;
}

/**
 * Fills in any months missing from `series` (keyed by "YYYY-MM") with `emptyValue`,
 * so a chart doesn't silently skip a month with zero activity. Range is [from, to]
 * inclusive, both in the business timezone.
 */
export function fillMonthGaps<T>(
  series: Map<string, T>,
  from: Date,
  to: Date,
  emptyValue: T,
  timeZone: string = BUSINESS_TIMEZONE
): Array<{ month: string; value: T }> {
  const result: Array<{ month: string; value: T }> = [];
  const startKey = businessMonthKey(from, timeZone);
  const endKey = businessMonthKey(to, timeZone);
  let [y, m] = startKey.split("-").map(Number);
  const [endY, endM] = endKey.split("-").map(Number);
  while (y < endY || (y === endY && m <= endM)) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    result.push({ month: key, value: series.get(key) ?? emptyValue });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return result;
}
