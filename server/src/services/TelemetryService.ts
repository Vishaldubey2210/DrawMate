import { ProductAnalyticsEvent } from '../models/ProductAnalyticsEvent.js';
import { RoundTelemetry } from '../models/RoundTelemetry.js';
import { featureFlagService } from '../config/featureFlags.js';
import { logger } from '../utils/logger.js';

export interface TelemetryPayload {
  eventName: string;
  userId?: string | null;
  sessionId?: string;
  gameId?: string;
  platform?: string;
  properties?: Record<string, any>;
}

// Keys forbidden from ordinary analytics to protect privacy and secret-word integrity
const STRICTLY_FORBIDDEN_PROPERTIES = new Set([
  'word',
  'secretword',
  'secret_word',
  'guess',
  'guessedword',
  'text',
  'message',
  'chatmessage',
  'canvas',
  'drawing',
  'imposterid',
  'impostorid',
  'password',
  'token',
  'cookie',
  'authorization',
]);

function sanitizeTelemetryProperties(props?: Record<string, any>): Record<string, any> {
  if (!props || typeof props !== 'object') return {};

  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(props)) {
    const lowerKey = key.toLowerCase();
    if (STRICTLY_FORBIDDEN_PROPERTIES.has(lowerKey)) {
      continue; // Drop completely
    }
    // Only accept primitive types or simple arrays/objects
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      clean[key] = value;
    } else if (Array.isArray(value)) {
      clean[key] = value.length; // Record count instead of raw array
    } else if (value && typeof value === 'object') {
      clean[key] = sanitizeTelemetryProperties(value);
    }
  }
  return clean;
}

export class TelemetryService {
  /**
   * Persists authoritative round telemetry for difficulty modeling
   */
  public static async recordRound(payload: any): Promise<any> {
    try {
      return await RoundTelemetry.create(payload);
    } catch (err: any) {
      logger.debug(`Round telemetry save suppressed error: ${err.message}`, undefined, 'Telemetry');
      return null;
    }
  }

  public static async getWordMetrics(word: string, language: string): Promise<any> {
    const records = await RoundTelemetry.find({ word: word.toLowerCase().trim(), language });
    const roundsObserved = records.length;
    const solves = records.filter((r) => r.solved).length;
    const timeouts = records.filter((r) => r.timedOut).length;
    const smoothedSolveRate = roundsObserved > 0 ? (solves + 2) / (roundsObserved + 4) : 0.5;
    const empiricalDifficulty =
      smoothedSolveRate >= 0.7 ? 'easy' : smoothedSolveRate >= 0.4 ? 'medium' : 'hard';
    const timeoutRate = roundsObserved > 0 ? timeouts / roundsObserved : 0;
    const rawSolveRate = roundsObserved > 0 ? solves / roundsObserved : 0;

    return {
      word,
      language,
      roundsObserved,
      solves,
      timeouts,
      rawSolveRate,
      smoothedSolveRate,
      timeoutRate,
      empiricalDifficulty,
    };
  }

  public static calculateAdaptiveWeight(metrics: { timeoutRate: number; smoothedSolveRate: number }): number {
    if (metrics.timeoutRate > 0.7) return 0.3;
    if (metrics.smoothedSolveRate > 0.8) return 1.2;
    return 1.0;
  }

  public async trackEvent(payload: TelemetryPayload): Promise<void> {
    if (!featureFlagService.isEnabled('telemetryEnabled')) {
      return;
    }

    try {
      const sanitizedProps = sanitizeTelemetryProperties(payload.properties);

      // Async write to persistence without awaiting in callers
      await ProductAnalyticsEvent.create({
        eventName: payload.eventName.trim().toLowerCase(),
        timestamp: new Date(),
        schemaVersion: 1,
        userId: payload.userId || null,
        sessionId: payload.sessionId || null,
        gameId: payload.gameId || null,
        platform: payload.platform || 'web',
        appVersion: '1.0.0-beta',
        properties: sanitizedProps,
      });
    } catch (err: any) {
      // Telemetry must NEVER break application or game workflow
      logger.debug(`Telemetry tracking suppressed error: ${err.message}`, undefined, 'Telemetry');
    }
  }

  public async getProductKpis(days = 7): Promise<{
    periodDays: number;
    totalEvents: number;
    eventsSummary: Record<string, number>;
    featureAdoption: Record<string, number>;
  }> {
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const aggregateCounts = await ProductAnalyticsEvent.aggregate([
      { $match: { timestamp: { $gte: sinceDate } } },
      { $group: { _id: '$eventName', count: { $sum: 1 } } },
    ]);

    const eventsSummary: Record<string, number> = {};
    let totalEvents = 0;

    for (const item of aggregateCounts) {
      eventsSummary[item._id] = item.count;
      totalEvents += item.count;
    }

    // Feature adoption breakdown
    const featureEvents = [
      'classic_match_started',
      'imposter_match_started',
      'ai_practice_session_started',
      'replay_viewed',
      'custom_pack_used',
      'genai_pack_generated',
    ];

    const featureAdoption: Record<string, number> = {};
    for (const feat of featureEvents) {
      featureAdoption[feat] = eventsSummary[feat] || 0;
    }

    return {
      periodDays: days,
      totalEvents,
      eventsSummary,
      featureAdoption,
    };
  }
}

export const telemetryService = new TelemetryService();
