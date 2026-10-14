import { AuditLog } from '../models/AuditLog.js';
import { Report, IReport } from '../models/Report.js';

export interface ChatModerationResult {
  permitted: boolean;
  flagged: boolean;
  category?: string;
  reason?: string;
  provider: 'groq' | 'openai' | 'heuristic_fallback';
  confidenceScore?: number;
}

export interface DrawingModerationResult {
  reportId?: string;
  status: 'flagged_for_review' | 'clean' | 'under_review';
  riskScore: number;
  reason?: string;
  provider: 'vision_ai' | 'heuristic_fallback';
  recommendedAction?: 'none' | 'warn' | 'kick' | 'review';
}

// In-memory rate limits for chat messages per user:room (5 messages per 4 seconds)
const chatRateLimits = new Map<string, { count: number; resetAt: number; lastMessage: string }>();

export const MAX_RATE_LIMIT_CAPACITY = 2000;
const CLEANUP_THROTTLE_MS = 2000;
const CLEANUP_SIZE_THRESHOLD = 1000;
let lastPruneTimestamp = 0;
let lastOverflowLogTimestamp = 0;

// Deterministic heuristic profanity & hate speech filters for robust offline / fallback safety
const FLAGGED_KEYWORDS = [
  'nigger', 'nigga', 'faggot', 'kike', 'chink', 'retard', 'kill yourself',
  'kys', 'cunt', 'whore', 'slut', 'die bitch', 'nazi', 'hitler did nothing wrong',
  'terrorist bomb', 'child porn', 'cp link'
];

export class AIModerationService {
  /**
   * Helper to retrieve current tracked rate limit count for observability and testing
   */
  public static getRateLimitMapSize(): number {
    return chatRateLimits.size;
  }

  /**
   * Clears all in-memory rate limits (primarily for testing)
   */
  public static resetRateLimits(): void {
    chatRateLimits.clear();
    lastPruneTimestamp = 0;
    lastOverflowLogTimestamp = 0;
  }

  /**
   * Prunes all expired rate-limit records from memory
   */
  public static pruneExpiredRateLimits(now = Date.now()): number {
    let evicted = 0;
    for (const [key, limit] of chatRateLimits.entries()) {
      if (now > limit.resetAt) {
        chatRateLimits.delete(key);
        evicted++;
      }
    }
    lastPruneTimestamp = now;
    return evicted;
  }

  /**
   * Deterministic abuse and rate-limit guard with memory bounding & expiry cleanup
   */
  public static checkChatRateLimit(
    userId: string,
    roomCode: string,
    rawText: string
  ): { allowed: boolean; error?: string } {
    const now = Date.now();
    const key = `${userId}:${roomCode}`;
    const normalizedText = rawText.trim().toLowerCase();

    const existing = chatRateLimits.get(key);

    // If key is not yet tracked, check if cleanup or capacity check is needed
    if (!existing) {
      if (
        chatRateLimits.size >= CLEANUP_SIZE_THRESHOLD &&
        (now - lastPruneTimestamp > CLEANUP_THROTTLE_MS || chatRateLimits.size >= MAX_RATE_LIMIT_CAPACITY)
      ) {
        AIModerationService.pruneExpiredRateLimits(now);
      }

      // Safe overflow policy: If map remains saturated with active entries, reject new keys
      // rather than evicting active users (which would allow rate-limit bypass)
      if (chatRateLimits.size >= MAX_RATE_LIMIT_CAPACITY) {
        if (now - lastOverflowLogTimestamp > 10000) {
          lastOverflowLogTimestamp = now;
          console.warn(
            `[AIModerationService] Chat rate-limit capacity (${MAX_RATE_LIMIT_CAPACITY}) saturated with active entries. Rejecting new key.`
          );
        }
        return {
          allowed: false,
          error: 'Chat service is temporarily congested. Please wait a moment.',
        };
      }
    }

    const limit = existing || { count: 0, resetAt: now + 4000, lastMessage: '' };

    if (now > limit.resetAt) {
      limit.count = 0;
      limit.resetAt = now + 4000;
    }

    if (limit.count >= 5) {
      return {
        allowed: false,
        error: 'You are sending messages too quickly. Please wait a few seconds.',
      };
    }

    if (limit.lastMessage && limit.lastMessage === normalizedText && normalizedText.length > 2) {
      return {
        allowed: false,
        error: 'Duplicate message ignored.',
      };
    }

    limit.count += 1;
    limit.lastMessage = normalizedText;
    chatRateLimits.set(key, limit);

    return { allowed: true };
  }

  /**
   * Evaluates chat content using OpenAI Moderation API or deterministic fallback
   */
  public static async moderateChatMessage(
    text: string,
    userId: string,
    roomCode: string
  ): Promise<ChatModerationResult> {
    const trimmed = text.trim();
    if (!trimmed) {
      return { permitted: false, flagged: false, reason: 'Empty message', provider: 'heuristic_fallback' };
    }

    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: 'openai/gpt-oss-120b',
            messages: [
              {
                role: 'system',
                content:
                  'You are a chat safety filter for a family-friendly drawing game. Check if the message contains toxic hate speech, severe profanity, harassment, or slurs. Return strictly JSON: {"flagged": boolean, "category": string, "reason": string}',
              },
              { role: 'user', content: trimmed },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) {
          const resJson: any = await response.json();
          const parsed = JSON.parse(resJson?.choices?.[0]?.message?.content || '{}');
          if (parsed && parsed.flagged) {
            await AuditLog.create({
              actorId: userId,
              action: 'CHAT_MODERATION_BLOCKED',
              targetType: 'Room',
              targetId: roomCode,
              reason: parsed.reason || 'Blocked by Groq safety policy',
              metadata: { category: parsed.category, provider: 'groq' },
            }).catch(() => {});

            return {
              permitted: false,
              flagged: true,
              category: parsed.category || 'inappropriate_content',
              reason: parsed.reason || 'Message blocked due to inappropriate content.',
              provider: 'groq',
              confidenceScore: 0.95,
            };
          }
          return { permitted: true, flagged: false, provider: 'groq' };
        }
      } catch (err: any) {
        console.warn('[AIModerationService] Groq moderation provider unreachable, using fallback heuristics:', err?.message);
      }
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (apiKey) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);

        const response = await fetch('https://api.openai.com/v1/moderations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            input: trimmed,
            model: 'omni-moderation-latest',
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) {
          const data: any = await response.json();
          const result = data?.results?.[0];

          if (result && result.flagged) {
            // Find highest violated category
            let topCategory = 'content_policy_violation';
            let maxScore = 0;
            if (result.category_scores) {
              for (const [cat, score] of Object.entries(result.category_scores)) {
                if ((score as number) > maxScore) {
                  maxScore = score as number;
                  topCategory = cat;
                }
              }
            }

            // Log event to AuditLog
            await AuditLog.create({
              actorId: userId,
              action: 'CHAT_MODERATION_BLOCKED',
              targetType: 'Room',
              targetId: roomCode,
              reason: `Violated moderation category: ${topCategory}`,
              metadata: {
                category: topCategory,
                score: maxScore,
                provider: 'openai',
              },
            }).catch(() => {});

            return {
              permitted: false,
              flagged: true,
              category: topCategory,
              reason: `Message blocked due to inappropriate content (${topCategory.replace(/_/g, ' ')}).`,
              provider: 'openai',
              confidenceScore: maxScore,
            };
          }

          return { permitted: true, flagged: false, provider: 'openai' };
        }
      } catch (err: any) {
        // Fallback gracefully on timeout or provider error
        console.warn('[AIModerationService] OpenAI moderation provider unreachable, using fallback heuristics:', err?.message);
      }
    }

    // Heuristic fallback
    const lower = trimmed.toLowerCase();
    for (const kw of FLAGGED_KEYWORDS) {
      if (lower.includes(kw)) {
        await AuditLog.create({
          actorId: userId,
          action: 'CHAT_MODERATION_BLOCKED',
          targetType: 'Room',
          targetId: roomCode,
          reason: 'Triggered safety keyword filter',
          metadata: { keyword: kw, provider: 'heuristic_fallback' },
        }).catch(() => {});

        return {
          permitted: false,
          flagged: true,
          category: 'hate_or_harassment',
          reason: 'Message contains prohibited language.',
          provider: 'heuristic_fallback',
          confidenceScore: 0.95,
        };
      }
    }

    return { permitted: true, flagged: false, provider: 'heuristic_fallback' };
  }

  /**
   * Reviews user-reported drawing content. Never auto-bans on a single AI score;
   * records verified audit log and assigns status for human / moderator review.
   */
  public static async moderateReportedDrawing(params: {
    reporterId: string;
    targetUserId: string;
    roomCode: string;
    drawingData?: string;
    explanation: string;
  }): Promise<DrawingModerationResult> {
    const { reporterId, targetUserId, roomCode, drawingData, explanation } = params;

    let riskScore = 0.3; // Default baseline risk for user-reported incident
    let provider: 'vision_ai' | 'heuristic_fallback' = 'heuristic_fallback';
    let recommendedAction: 'none' | 'warn' | 'kick' | 'review' = 'review';

    // If base64 drawing data is provided, run vision review with Groq or Gemini
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey && drawingData && drawingData.startsWith('data:image/')) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: 'qwen/qwen3.8-27b',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Analyze this drawing for NSFW, nudity, hate symbols, or harassment. Respond with JSON: {"flagged": boolean, "riskScore": number between 0.0 and 1.0, "reason": string}',
                  },
                  {
                    type: 'image_url',
                    image_url: { url: drawingData },
                  },
                ],
              },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) {
          const resData: any = await response.json();
          const content = resData?.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            riskScore = typeof parsed.riskScore === 'number' ? parsed.riskScore : (parsed.flagged ? 0.8 : 0.2);
            provider = 'vision_ai';
            if (riskScore > 0.8) {
              recommendedAction = 'kick';
            } else if (riskScore > 0.5) {
              recommendedAction = 'warn';
            }
          }
        }
      } catch (err: any) {
        console.warn('[AIModerationService] Groq vision moderation error, fallback to gemini/heuristic:', err?.message);
      }
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (provider !== 'vision_ai' && geminiKey && drawingData && drawingData.startsWith('data:image/')) {
      try {
        const base64Content = drawingData.split(',')[1];
        const mimeType = drawingData.split(';')[0].replace('data:', '');

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: 'Analyze this drawing for NSFW, nudity, hate symbols, or harassment. Respond with JSON: {"flagged": boolean, "riskScore": number (0 to 1), "reason": string}' },
                  { inline_data: { mime_type: mimeType, data: base64Content } },
                ],
              },
            ],
            generationConfig: { responseMimeType: 'application/json' },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) {
          const resData: any = await response.json();
          const text = resData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text);
            riskScore = typeof parsed.riskScore === 'number' ? parsed.riskScore : 0.5;
            provider = 'vision_ai';
            if (riskScore > 0.8) {
              recommendedAction = 'kick';
            } else if (riskScore > 0.5) {
              recommendedAction = 'warn';
            }
          }
        }
      } catch (err: any) {
        console.warn('[AIModerationService] Vision moderation fallback to heuristic review:', err?.message);
      }
    }

    // Persist a formal Report in database
    const report = await Report.create({
      reporterId,
      targetType: 'user',
      targetId: targetUserId,
      category: 'inappropriate_drawing',
      explanation: `${explanation || 'Drawing reported by player'} [AI Risk Score: ${(riskScore * 100).toFixed(0)}%, Provider: ${provider}]`,
      status: 'under_review',
    });

    // Record in AuditLog for administrative transparency
    await AuditLog.create({
      actorId: reporterId,
      action: 'DRAWING_REPORT_SUBMITTED',
      targetType: 'User',
      targetId: targetUserId,
      reason: `Reported inappropriate drawing in room ${roomCode}`,
      metadata: {
        reportId: report._id.toString(),
        roomCode,
        riskScore,
        provider,
        recommendedAction,
      },
    });

    return {
      reportId: report._id.toString(),
      status: 'under_review',
      riskScore,
      provider,
      recommendedAction,
      reason: 'Drawing submitted for human moderator inspection. Game session protected.',
    };
  }
}
