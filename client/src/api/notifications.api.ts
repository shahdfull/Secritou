import apiClient from './axios';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
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
