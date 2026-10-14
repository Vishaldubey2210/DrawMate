import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { SketchRecognizerClient } from '../services/SketchRecognizerClient.js';

// Simple user rate-limiting for practice prediction (1 request per 1.5 seconds)
const userPredictionLimits = new Map<string, number>();

export async function getPracticeHealth(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const health = await SketchRecognizerClient.checkHealth();
    res.status(200).json({ success: true, ...health });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to inspect practice service health.' });
  }
}

export async function predictPracticeDrawing(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  const { image, topK } = req.body;
  if (!image || typeof image !== 'string' || image.trim().length < 20) {
    res.status(400).json({ success: false, error: 'Valid Base64 image data is required.' });
    return;
  }

  // Rate limiting guard
  const now = Date.now();
  if (userPredictionLimits.size > 2000) {
    const cutoff = now - 60000;
    for (const [uid, ts] of userPredictionLimits.entries()) {
      if (ts < cutoff) userPredictionLimits.delete(uid);
    }
  }

  const lastTime = userPredictionLimits.get(userId) || 0;
  if (now - lastTime < 1200) {
    res.status(429).json({
      success: false,
      error: 'Please wait a moment before asking AI to check your drawing again.',
    });
    return;
  }
  userPredictionLimits.set(userId, now);

  try {
    const result = await SketchRecognizerClient.predictSketch(image, topK || 3);
    res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Inference prediction failed.' });
  }
}
