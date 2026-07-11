// Single source of truth mapping a contact-form serviceType (the zod enum in
// validators/contact.validator.ts) to a Service.name. "Other" maps to null: the lead lands
// unassigned (visible to ADMIN only) for manual triage rather than being forced into a pole.

// The four canonical poles, matching the names seeded for each company.
export const SERVICE_NAMES = [
  "Management & Performance",
  "Croissance digitale",
  "Technologie",
  "IA & Automatisation",
] as const;

export type ServiceName = (typeof SERVICE_NAMES)[number];

// serviceType (form) → Service.name. Identity mapping today since the form values already
// match the pole names, but kept explicit so the two can diverge without breaking the bridge.
const SERVICE_TYPE_TO_NAME: Record<string, ServiceName | null> = {
  "Management & Performance": "Management & Performance",
  "Croissance digitale": "Croissance digitale",
  "Technologie": "Technologie",
  "IA & Automatisation": "IA & Automatisation",
  Other: null,
};

export function serviceNameForType(serviceType: string): ServiceName | null {
  return SERVICE_TYPE_TO_NAME[serviceType] ?? null;
}
