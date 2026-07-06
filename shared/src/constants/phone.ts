// Tunisian mobile/landline numbers: 8 digits starting 2-9, optionally
// prefixed with +216 (no prefix without the +, e.g. "216..." is rejected —
// that's ambiguous with a local number starting with 2).
export const TN_PHONE_RE = /^(\+216)?[2-9]\d{7}$/;

export function isValidTunisianPhone(raw: string): boolean {
  const normalized = raw.replace(/[\s.-]/g, "");
  if (normalized === "") return true; // optional field
  return TN_PHONE_RE.test(normalized);
}
