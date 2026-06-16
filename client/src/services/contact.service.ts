import { apiClient } from "./apiClient";

const serviceTypes = [
  "Business Performance",
  "Digital Growth",
  "Technology Solutions",
  "AI & Automation",
  "Other"
] as const;

const budgetOptions = [
  "< 1 000 DT",
  "1 000–5 000 DT",
  "5 000–15 000 DT",
  "+15 000 DT"
] as const;

export type ServiceType = typeof serviceTypes[number];
export type BudgetOption = typeof budgetOptions[number];

export type ContactPayload = {
  name: string;
  email: string;
  phone?: string;
  serviceType: ServiceType;
  budget?: BudgetOption;
  company: string;
  message: string;
};

export type ContactResponse = {
  success: boolean;
  message: string;
};

export function submitContactRequest(payload: ContactPayload) {
  return apiClient<ContactResponse>("/contact", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
