import apiClient from "@/api/axios";
import type { ContactServiceType, ContactBudgetOption } from "@secritou/shared";

export type ServiceType = ContactServiceType;
export type BudgetOption = ContactBudgetOption;

export type ContactPayload = {
  name: string;
  email: string;
  phone?: string;
  serviceType: ServiceType;
  budget?: BudgetOption;
  company: string;
  message: string;
  // Honeypot: hidden form field, must stay empty for real submissions. See
  // ContactPage.tsx and server/src/controllers/contact.controller.ts.
  website?: string;
};

export type ContactResponse = {
  success: boolean;
  message: string;
};

export async function submitContactRequest(payload: ContactPayload): Promise<ContactResponse> {
  const response = await apiClient.post<ContactResponse>("/contact", payload);
  return response.data;
}
