import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { CustomWordPack } from '../models/CustomWordPack.js';
import { GenAIProviderService } from '../services/GenAIProviderService.js';
import { operationalMetrics } from '../services/OperationalMetrics.js';
import { telemetryService } from '../services/TelemetryService.js';
import mongoose from 'mongoose';

const MAX_PACKS_PER_USER = 20;
const MIN_WORDS = 5;
const MAX_WORDS = 500;
const MIN_WORD_LEN = 2;
const MAX_WORD_LEN = 60;

/**
 * Validates, trims and deduplicates custom words
 */
function sanitizeWords(rawWords: any[]): { validWords: string[]; error?: string } {
  if (!Array.isArray(rawWords)) {
    return { validWords: [], error: 'Words must be provided as an array.' };
  }

  const seen = new Set<string>();
  const validWords: string[] = [];

  for (const item of rawWords) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;

    if (trimmed.length < MIN_WORD_LEN || trimmed.length > MAX_WORD_LEN) {
      return {
        validWords: [],
        error: `Word "${trimmed}" must be between ${MIN_WORD_LEN} and ${MAX_WORD_LEN} characters.`,
      };
    }

    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      validWords.push(trimmed);
    }
  }

  if (validWords.length < MIN_WORDS) {
    return {
      validWords: [],
      error: `Pack must contain at least ${MIN_WORDS} unique words (received ${validWords.length}).`,
    };
  }

  if (validWords.length > MAX_WORDS) {
    return {
      validWords: [],
      error: `Pack cannot exceed ${MAX_WORDS} words (received ${validWords.length}).`,
    };
  }

  return { validWords };
}

export async function createWordPack(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const existingCount = await CustomWordPack.countDocuments({ ownerId: userId });
    if (existingCount >= MAX_PACKS_PER_USER) {
      res.status(400).json({
        success: false,
        error: `You have reached the limit of ${MAX_PACKS_PER_USER} custom word packs.`,
      });
      return;
    }

    const { name, description, language = 'en', category = 'custom', words, isPublic = false } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 50) {
      res.status(400).json({ success: false, error: 'Pack name must be between 2 and 50 characters.' });
      return;
    }

    const validLangs = ['en', 'hi', 'es'];
    if (!validLangs.includes(language)) {
      res.status(400).json({ success: false, error: 'Language must be one of: en, hi, es.' });
      return;
    }

    const { validWords, error: wordError } = sanitizeWords(words);
    if (wordError) {
      res.status(400).json({ success: false, error: wordError });
      return;
    }

    const pack = await CustomWordPack.create({
      ownerId: userId,
      name: name.trim(),
      description: typeof description === 'string' ? description.trim().slice(0, 200) : '',
      language,
      category: typeof category === 'string' ? category.trim() : 'custom',
      words: validWords,
      isPublic: Boolean(isPublic),
    });

    res.status(201).json({
      success: true,
      pack,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to create word pack.' });
  }
}

export async function getMyWordPacks(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const packs = await CustomWordPack.find({ ownerId: userId }).sort({ updatedAt: -1 });

    res.json({
      success: true,
      packs,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to retrieve word packs.' });
  }
}

export async function getPublicWordPacks(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const language = req.query.language as string;
    const filter: any = { isPublic: true };
    if (language && ['en', 'hi', 'es'].includes(language)) {
      filter.language = language;
    }

    const packs = await CustomWordPack.find(filter)
      .populate('ownerId', 'displayName username avatar')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      packs,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to retrieve public word packs.' });
  }
}

export async function getWordPackById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: 'Invalid pack ID format.' });
      return;
    }

    const pack = await CustomWordPack.findById(id).populate('ownerId', 'displayName username');
    if (!pack) {
      res.status(404).json({ success: false, error: 'Word pack not found.' });
      return;
    }

    const currentUserId = req.userId?.toString();
    const isOwner = pack.ownerId && (pack.ownerId as any)._id?.toString() === currentUserId;

    if (!pack.isPublic && !isOwner) {
      res.status(403).json({ success: false, error: 'Access denied: This word pack is private.' });
      return;
    }

    res.json({
      success: true,
      pack,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to retrieve word pack.' });
  }
}

export async function updateWordPack(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId?.toString();
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: 'Invalid pack ID format.' });
      return;
    }

    const pack = await CustomWordPack.findById(id);
    if (!pack) {
      res.status(404).json({ success: false, error: 'Word pack not found.' });
      return;
    }

    if (pack.ownerId.toString() !== userId) {
      res.status(403).json({ success: false, error: 'Unauthorized: You can only edit your own word packs.' });
      return;
    }

    const { name, description, language, category, words, isPublic } = req.body;

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 50) {
        res.status(400).json({ success: false, error: 'Pack name must be between 2 and 50 characters.' });
        return;
      }
      pack.name = name.trim();
    }

    if (description !== undefined) {
      pack.description = typeof description === 'string' ? description.trim().slice(0, 200) : '';
    }

    if (language !== undefined) {
      if (!['en', 'hi', 'es'].includes(language)) {
        res.status(400).json({ success: false, error: 'Language must be one of: en, hi, es.' });
        return;
      }
      pack.language = language;
    }

    if (category !== undefined) {
      pack.category = typeof category === 'string' ? category.trim() : 'custom';
    }

    if (words !== undefined) {
      const { validWords, error: wordError } = sanitizeWords(words);
      if (wordError) {
        res.status(400).json({ success: false, error: wordError });
        return;
      }
      pack.words = validWords;
    }

    if (isPublic !== undefined) {
      pack.isPublic = Boolean(isPublic);
    }

    pack.updatedAt = new Date();
    await pack.save();

    res.json({
      success: true,
      pack,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to update word pack.' });
  }
}

export async function deleteWordPack(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId?.toString();
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: 'Invalid pack ID format.' });
      return;
    }

    const pack = await CustomWordPack.findById(id);
    if (!pack) {
      res.status(404).json({ success: false, error: 'Word pack not found.' });
      return;
    }

    if (pack.ownerId.toString() !== userId) {
      res.status(403).json({ success: false, error: 'Unauthorized: You can only delete your own word packs.' });
      return;
    }

    await CustomWordPack.deleteOne({ _id: id });

    res.json({
      success: true,
      message: 'Word pack deleted successfully.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to delete word pack.' });
  }
}

/**
 * GenAI-powered Word-Pack generation
 */
export async function generateWordPackAI(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const result = await GenAIProviderService.generateWordPack(req.body);
    const fallbackUsed = result.providerUsed === 'mock';
    operationalMetrics.recordGenAiRequest(true, fallbackUsed);

    telemetryService.trackEvent({
      eventName: 'genai_pack_generated',
      userId: req.userId?.toString() || null,
      properties: {
        providerUsed: result.providerUsed,
        fallbackUsed,
        wordCount: result.words.length,
      },
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    operationalMetrics.recordGenAiRequest(false);
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to generate word pack with AI.',
    });
  }
}

