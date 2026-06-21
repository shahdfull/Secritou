// Single source of truth mapping a contact-form serviceType (the zod enum in
// validators/contact.validator.ts) to a Service.name. "Other" maps to null: the lead lands
// unassigned (visible to ADMIN only) for manual triage rather than being forced into a pole.

// The four canonical poles, matching the names seeded for each company.
export const SERVICE_NAMES = [
  "Business Performance",
  "Digital Growth",
  "Technology Solutions",
  "AI & Automation",
] as const;

export type ServiceName = (typeof SERVICE_NAMES)[number];

// serviceType (form) → Service.name. Identity mapping today since the form values already
// match the pole names, but kept explicit so the two can diverge without breaking the bridge.
const SERVICE_TYPE_TO_NAME: Record<string, ServiceName | null> = {
  "Business Performance": "Business Performance",
  "Digital Growth": "Digital Growth",
  "Technology Solutions": "Technology Solutions",
  "AI & Automation": "AI & Automation",
  Other: null,
};

export function serviceNameForType(serviceType: string): ServiceName | null {
  return SERVICE_TYPE_TO_NAME[serviceType] ?? null;
}
