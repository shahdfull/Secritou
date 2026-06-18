import { apiClient } from "./apiClient";

const _serviceTypes = [
  "Management & Performance",
  "Digital Growth",
  "Technology",
  "AI & Automation",
  "Other"
] as const;

const _budgetOptions = [
  "< 1 000 DT",
  "1 000–5 000 DT",
  "5 000–15 000 DT",
  "+15 000 DT"
] as const;

export type ServiceType = typeof _serviceTypes[number];
export type BudgetOption = typeof _budgetOptions[number];

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
