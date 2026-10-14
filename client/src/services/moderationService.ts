import { api } from './api.js';
import { ReportItem, AuditLogItem, User } from '../types/index.js';

export async function submitReport(data: {
  targetType: 'user' | 'match' | 'room';
  targetId: string;
  category: string;
  explanation: string;
}): Promise<{ success: boolean; message: string; report?: ReportItem }> {
  const res = await api.post('/reports', data);
  return res.data;
}

export async function getReports(status?: string, page = 1): Promise<{
  reports: ReportItem[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const res = await api.get('/admin/reports', { params: { status, page } });
  return res.data;
}

export async function updateReportStatus(
  id: string,
  status: string,
  moderatorNotes?: string
): Promise<{ success: boolean; message: string }> {
  const res = await api.patch(`/admin/reports/${id}`, { status, moderatorNotes });
  return res.data;
}

export async function performModerationAction(actionData: {
  action: 'kick' | 'suspend' | 'ban' | 'unban';
  targetUserId?: string;
  roomCode?: string;
  durationHours?: number;
  reason?: string;
}): Promise<{ success: boolean; message: string }> {
  const res = await api.post('/admin/moderation/action', actionData);
  return res.data;
}

export async function getAuditLogs(page = 1): Promise<{
  logs: AuditLogItem[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const res = await api.get('/admin/audit-logs', { params: { page } });
  return res.data;
}

export async function getAdminUsers(query = '', page = 1): Promise<{
  users: User[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const res = await api.get('/admin/users', { params: { q: query, page } });
  return res.data;
}
