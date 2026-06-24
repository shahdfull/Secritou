import apiClient from "@/api/axios";

// Must stay identical (character for character) to the backend enum in
// server/src/validators/contact.validator.ts : otherwise the contact form fails validation.
const _serviceTypes = [
  "Business Performance",
  "Digital Growth",
  "Technology Solutions",
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

export async function submitContactRequest(payload: ContactPayload): Promise<ContactResponse> {
  const response = await apiClient.post<ContactResponse>("/contact", payload);
  return response.data;
}
