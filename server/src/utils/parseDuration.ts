/** Parse duration strings like 15m, 7d, 1h into milliseconds */
export function parseDurationToMs(value: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/i.exec(value.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return amount * (multipliers[unit] ?? multipliers.d);
}

export function parseDurationToDate(value: string): Date {
  return new Date(Date.now() + parseDurationToMs(value));
}
