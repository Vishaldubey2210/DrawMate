import { api } from './api.js';

export interface BetaFeatureFlags {
  imposterModeEnabled: boolean;
  genAiWordPacksEnabled: boolean;
  aiPracticeEnabled: boolean;
  drawingReplayEnabled: boolean;
  customWordPacksEnabled: boolean;
  betaFeedbackEnabled: boolean;
  betaAccessOnly: boolean;
  telemetryEnabled: boolean;
}

export interface FeedbackSubmission {
  category: string;
  description: string;
  gameId?: string;
  roomCode?: string;
  clientDiagnostics?: {
    userAgent?: string;
    screenResolution?: string;
    latencyEstimateMs?: number;
  };
}

export interface FeedbackItem {
  _id: string;
  userId?: string;
  username?: string;
  category: string;
  description: string;
  appVersion: string;
  gameId?: string;
  roomCode?: string;
  status: 'new' | 'reviewed' | 'resolved';
  adminNotes?: string;
  createdAt: string;
}

export async function getPublicFeatureFlags(): Promise<BetaFeatureFlags> {
  const res = await api.get('/features');
  return res.data.flags;
}

export async function submitFeedback(payload: FeedbackSubmission): Promise<{ success: boolean; message: string }> {
  const res = await api.post('/feedback', payload);
  return res.data;
}

export async function getOperationalMetrics(): Promise<any> {
  const res = await api.get('/admin/metrics/operational');
  return res.data.data;
}

export async function getProductAnalytics(days = 7): Promise<any> {
  const res = await api.get('/admin/metrics/analytics', { params: { days } });
  return res.data.data;
}

export async function getIncidentDiagnostics(): Promise<any> {
  const res = await api.get('/admin/incidents');
  return res.data;
}

export async function updateFeatureFlags(flags: Partial<BetaFeatureFlags>): Promise<BetaFeatureFlags> {
  const res = await api.patch('/admin/features', flags);
  return res.data.flags;
}

export async function getAdminFeedbacks(status?: string, category?: string, page = 1): Promise<{
  total: number;
  page: number;
  totalPages: number;
  feedbacks: FeedbackItem[];
}> {
  const res = await api.get('/admin/feedback', { params: { status, category, page } });
  return res.data.data;
}

export async function updateFeedbackStatus(
  id: string,
  status: 'new' | 'reviewed' | 'resolved',
  adminNotes?: string
): Promise<{ success: boolean; message: string }> {
  const res = await api.patch(`/admin/feedback/${id}`, { status, adminNotes });
  return res.data;
}
