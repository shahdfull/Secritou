import { z } from "zod";

export const currencyCode = z.string().length(3).toUpperCase();
export const positiveDecimal = z.number().positive();
