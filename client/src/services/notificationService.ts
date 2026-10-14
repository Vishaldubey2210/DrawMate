import { api } from './api.js';
import { NotificationItem } from '../types/index.js';

export async function getNotifications(page = 1, limit = 20): Promise<{
  notifications: NotificationItem[];
  total: number;
  unreadCount: number;
  page: number;
  totalPages: number;
}> {
  const res = await api.get('/notifications', { params: { page, limit } });
  return res.data;
}

export async function markNotificationRead(id: string): Promise<boolean> {
  const res = await api.patch(`/notifications/${id}/read`);
  return res.data.success;
}

export async function markAllNotificationsRead(): Promise<number> {
  const res = await api.patch('/notifications/read-all');
  return res.data.count || 0;
}
