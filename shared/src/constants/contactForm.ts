// Single source of truth for the public contact form's serviceType/budget
// enums. These values are persisted verbatim in ContactRequest/Lead rows and
// embedded in notification emails (server/src/services/contact.service.ts) —
// do not change the literal strings without a migration plan; renaming here
// would silently desync existing DB rows from new submissions.
export const CONTACT_SERVICE_TYPES = [
  "Business Performance",
  "Digital Growth",
  "Technology Solutions",
  "AI & Automation",
  "Other",
] as const;

export const CONTACT_BUDGET_OPTIONS = [
  "< 1 000 DT",
  "1 000–5 000 DT",
  "5 000–15 000 DT",
  "+15 000 DT",
] as const;

export type ContactServiceType = (typeof CONTACT_SERVICE_TYPES)[number];
export type ContactBudgetOption = (typeof CONTACT_BUDGET_OPTIONS)[number];
