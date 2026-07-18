import { z } from "zod";

// RG-001 (REFERENTIEL.md §5): every proposal/invoice is denominated in TND — no other currency
// is ever accepted in writing (SEC-032). Mirrors server/src/constants/currency.ts's
// DEFAULT_CURRENCY, duplicated here rather than imported since shared/ cannot depend on server/.
export const currencyCode = z.literal("TND");
export const positiveDecimal = z.number().positive();
