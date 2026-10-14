import { Request, Response } from 'express';
import { z } from 'zod';
import { featureFlagService } from '../config/featureFlags.js';
import { operationalMetrics } from '../services/OperationalMetrics.js';
import { telemetryService } from '../services/TelemetryService.js';
import { incidentDiagnosticService } from '../services/IncidentDiagnosticService.js';
import { Feedback } from '../models/Feedback.js';
import { User } from '../models/User.js';
import { emailService } from '../services/EmailService.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

// Validation schemas
const feedbackSchema = z.object({
  category: z.enum([
    'gameplay_bug',
    'drawing_touch',
    'connection',
    'scoring',
    'imposter_mode',
    'word_pack',
    'ai_practice',
    'performance',
    'general_suggestion',
  ]),
  description: z.string().min(5).max(2000),
  gameId: z.string().optional(),
  roomCode: z.string().optional(),
  clientDiagnostics: z
    .object({
      userAgent: z.string().optional(),
      screenResolution: z.string().optional(),
      latencyEstimateMs: z.number().optional(),
    })
    .optional(),
});

const updateFeatureFlagsSchema = z.object({
  imposterModeEnabled: z.boolean().optional(),
  genAiWordPacksEnabled: z.boolean().optional(),
  aiPracticeEnabled: z.boolean().optional(),
  drawingReplayEnabled: z.boolean().optional(),
  customWordPacksEnabled: z.boolean().optional(),
  betaFeedbackEnabled: z.boolean().optional(),
  betaAccessOnly: z.boolean().optional(),
  telemetryEnabled: z.boolean().optional(),
});

// 1. Public Feature Flags
export async function getPublicFeatureFlags(_req: Request, res: Response): Promise<void> {
  const flags = featureFlagService.getFlags();
  res.status(200).json({
    success: true,
    flags,
  });
}

// 2. Submit Player Feedback (Public/Authenticated with rate-limit)
export async function submitFeedback(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!featureFlagService.isEnabled('betaFeedbackEnabled')) {
    res.status(403).json({
      success: false,
      error: 'Beta feedback collection is currently paused.',
    });
    return;
  }

  const parseResult = feedbackSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: 'Invalid feedback submission: ' + parseResult.error.issues.map((i) => i.message).join(', '),
    });
    return;
  }

  const parsed = parseResult.data;

  const feedback = await Feedback.create({
    userId: req.user?._id || null,
    username: req.user?.displayName || req.user?.username || 'Anonymous Player',
    category: parsed.category,
    description: parsed.description,
    appVersion: '1.0.0-beta',
    gameId: parsed.gameId || null,
    roomCode: parsed.roomCode || null,
    clientDiagnostics: parsed.clientDiagnostics || {},
    status: 'new',
  });

  // Track event in telemetry
  telemetryService.trackEvent({
    eventName: 'feedback_submitted',
    userId: req.user?._id?.toString() || null,
    properties: {
      category: parsed.category,
      hasGameId: Boolean(parsed.gameId),
    },
  });

  res.status(201).json({
    success: true,
    message: 'Feedback received! Thank you for helping improve DrawMate.',
    feedbackId: feedback._id,
  });
}

// 3. Admin: Get Operational Metrics
export async function getOperationalMetrics(_req: Request, res: Response): Promise<void> {
  const snapshot = operationalMetrics.getSnapshot();
  res.status(200).json({
    success: true,
    data: snapshot,
  });
}

// 4. Admin: Get Product Analytics KPIs
export async function getProductAnalytics(req: Request, res: Response): Promise<void> {
  const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;
  const kpis = await telemetryService.getProductKpis(days);
  res.status(200).json({
    success: true,
    data: kpis,
  });
}

// 5. Admin: Get Incident Diagnostics
export async function getIncidentDiagnostics(_req: Request, res: Response): Promise<void> {
  const incidents = incidentDiagnosticService.getRecentIncidents(50);
  const summary = incidentDiagnosticService.getIncidentSummary();

  res.status(200).json({
    success: true,
    summary,
    incidents,
  });
}

// 6. Admin: Update Feature Flags
export async function updateFeatureFlags(req: AuthenticatedRequest, res: Response): Promise<void> {
  const parsed = updateFeatureFlagsSchema.parse(req.body);
  const updated = featureFlagService.updateFlags(parsed, req.user?.username || 'admin');

  res.status(200).json({
    success: true,
    message: 'Beta feature flags updated successfully.',
    flags: updated,
  });
}

// 7. Admin: List Player Feedbacks
export async function getAdminFeedbacks(req: Request, res: Response): Promise<void> {
  const status = req.query.status as string;
  const category = req.query.category as string;
  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));

  const filter: any = {};
  if (status && status !== 'all') filter.status = status;
  if (category && category !== 'all') filter.category = category;

  const total = await Feedback.countDocuments(filter);
  const feedbacks = await Feedback.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  res.status(200).json({
    success: true,
    data: {
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      feedbacks,
    },
  });
}

// 8. Admin: Update Feedback Status & Notes
export async function updateFeedbackStatus(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { status, adminNotes } = req.body;

  const feedback = await Feedback.findById(id);
  if (!feedback) {
    res.status(404).json({ success: false, error: 'Feedback record not found.' });
    return;
  }

  if (status) feedback.status = status;
  if (adminNotes !== undefined) feedback.adminNotes = adminNotes;
  await feedback.save();

  res.status(200).json({
    success: true,
    message: 'Feedback updated successfully.',
    feedback,
  });
}

// 9. Admin: Broadcast Announcement / Special Offer Email
export async function broadcastEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { title, bodyContent, actionUrl, actionText, testEmailOnly } = req.body;

  if (!title || !bodyContent) {
    res.status(400).json({
      success: false,
      error: 'Both title and bodyContent are required to broadcast an announcement.',
    });
    return;
  }

  // If testEmailOnly is provided, only send to that test address
  if (testEmailOnly) {
    const sent = await emailService.sendProductUpdateEmail(
      testEmailOnly,
      'Test User',
      title,
      bodyContent,
      actionUrl,
      actionText
    );
    res.status(200).json({
      success: true,
      message: `Test email sent to ${testEmailOnly}`,
      sentCount: sent ? 1 : 0,
    });
    return;
  }

  // Find all active users who haven't explicitly unsubscribed from productUpdates
  const targetUsers = await User.find(
    {
      status: 'active',
      'notificationPreferences.productUpdates': { $ne: false },
    },
    'email username displayName'
  ).lean();

  let sentCount = 0;
  // Send emails asynchronously in batches to avoid overwhelming SMTP
  for (const user of targetUsers) {
    if (user.email) {
      emailService
        .sendProductUpdateEmail(
          user.email,
          user.displayName || user.username,
          title,
          bodyContent,
          actionUrl,
          actionText
        )
        .catch((err) => {
          console.error(`Failed to send broadcast email to ${user.email}:`, err);
        });
      sentCount++;
    }
  }

  res.status(200).json({
    success: true,
    message: `Broadcast initiated for ${sentCount} user(s).`,
    recipientCount: sentCount,
  });
}

