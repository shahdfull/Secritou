import apiClient from './axios';

export type NotificationType =
  | 'PROPOSAL_SENT' | 'PROPOSAL_ACCEPTED' | 'PROPOSAL_REJECTED' | 'PROPOSAL_EXPIRED'
  | 'APPROVAL_REQUESTED' | 'APPROVAL_ACCEPTED' | 'APPROVAL_REJECTED'
  | 'INVOICE_SENT' | 'INVOICE_OVERDUE' | 'PAYMENT_RECEIVED'
  | 'PROJECT_STATUS_CHANGED' | 'TASK_ASSIGNED'
  | 'SERVICE_REQUEST_CREATED' | 'SERVICE_REQUEST_STATUS_CHANGED' | 'SERVICE_REQUEST_COMMENT'
  | 'BRIEF_COMPLETED' | 'DOCUMENT_SIGNED' | 'LEAD_CONVERTED'
  | 'FREELANCER_APPLICATION'
  | 'PROJECT_STALE' | 'PROJECT_DEADLINE_SOON' | 'INVOICE_FOLLOWUP'
  | 'TASK_DEADLINE_SOON'
  | 'GENERAL';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  entityId: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export const notificationsApi = {
  getNotifications: async (): Promise<Notification[]> => {
    const response = await apiClient.get<{ data: Notification[] }>('/notifications');
    return response.data.data;
  },
  markAsRead: async (id: string): Promise<Notification> => {
    const response = await apiClient.patch<{ data: Notification }>(`/notifications/${id}/read`);
    return response.data.data;
  },
  markAllAsRead: async (): Promise<void> => {
    await apiClient.patch('/notifications/read-all');
  },
};
