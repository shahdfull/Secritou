import apiClient from "./axios";

export interface Invoice {
  id: string;
  number: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  amountPaid: number;
  status: "DRAFT" | "SENT" | "PAID" | "PARTIAL" | "OVERDUE" | "CANCELLED";
  dueDate?: string;
  sentAt?: string;
  paidAt?: string;
  pdfUrl?: string;
  reminderPaused: boolean;
  clientId: string;
  projectId?: string;
  proposalId?: string;
  client?: { name: string };
  items?: InvoiceItem[];
  payments?: InvoicePayment[];
  reminders?: InvoiceReminder[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  invoiceId: string;
  createdAt: string;
}

export interface InvoicePayment {
  id: string;
  amount: number;
  method?: string;
  reference?: string;
  paidAt: string;
  invoiceId: string;
  createdAt: string;
}

export interface InvoiceReminder {
  id: string;
  type: string;
  sentAt: string;
  invoiceId: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const invoicesApi = {
  getInvoices: async (params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    clientId?: string;
  }) => {
    const response = await apiClient.get<{ data: PaginatedResponse<Invoice> }>("/invoices", {
      params,
    });
    return response.data.data;
  },

  getInvoiceById: async (id: string) => {
    const response = await apiClient.get<{ data: Invoice }>(`/invoices/${id}`);
    return response.data.data;
  },

  createInvoice: async (data: {
    number?: string;
    title: string;
    description?: string;
    amount: number;
    currency?: string;
    dueDate?: string;
    pdfUrl?: string;
    clientId: string;
    projectId?: string;
    proposalId?: string;
  }) => {
    const response = await apiClient.post<{ data: Invoice }>("/invoices", data);
    return response.data.data;
  },

  updateInvoice: async (id: string, data: Partial<Invoice>) => {
    const response = await apiClient.put<{ data: Invoice }>(`/invoices/${id}`, data);
    return response.data.data;
  },

  sendInvoice: async (id: string) => {
    const response = await apiClient.post<{ data: Invoice }>(`/invoices/${id}/send`);
    return response.data.data;
  },

  setReminderPaused: async (id: string, reminderPaused: boolean) => {
    const response = await apiClient.put<{ data: Invoice }>(`/invoices/${id}/reminder-paused`, { reminderPaused });
    return response.data.data;
  },

  cancelInvoice: async (id: string) => {
    const response = await apiClient.post<{ data: Invoice }>(`/invoices/${id}/cancel`);
    return response.data.data;
  },

  deleteInvoice: async (id: string) => {
    const response = await apiClient.delete<{ data: Invoice }>(`/invoices/${id}`);
    return response.data.data;
  },

  restoreInvoice: async (id: string) => {
    const response = await apiClient.post<{ data: Invoice }>(`/invoices/${id}/restore`);
    return response.data.data;
  },

  getTrash: async (params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    clientId?: string;
  }) => {
    const response = await apiClient.get<{ data: PaginatedResponse<Invoice> }>("/invoices/trash", { params });
    return response.data.data;
  },

  addPayment: async (id: string, data: { amount: number; method?: string; reference?: string; idempotencyKey?: string }) => {
    const response = await apiClient.post<{ data: InvoicePayment; warning?: string }>(`/invoices/${id}/payments`, data);
    return { ...response.data.data, warning: response.data.warning };
  },

  addReminder: async (id: string, data: { type: string }) => {
    const response = await apiClient.post<{ data: InvoiceReminder }>(`/invoices/${id}/reminders`, data);
    return response.data.data;
  },

  addItem: async (id: string, data: { description: string; quantity: number; unitPrice: number }) => {
    const response = await apiClient.post<{ data: InvoiceItem }>(`/invoices/${id}/items`, data);
    return response.data.data;
  },

  updateItem: async (id: string, itemId: string, data: Partial<InvoiceItem>) => {
    const response = await apiClient.put<{ data: InvoiceItem }>(`/invoices/${id}/items/${itemId}`, data);
    return response.data.data;
  },

  deleteItem: async (id: string, itemId: string) => {
    const response = await apiClient.delete<{ data: { success: boolean } }>(`/invoices/${id}/items/${itemId}`);
    return response.data.data;
  },
};
