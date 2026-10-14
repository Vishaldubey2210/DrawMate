import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { optionalAuth } from '../middleware/auth.js';
import {
  getPublicFeatureFlags,
  submitFeedback,
} from '../controllers/observabilityController.js';

const router = Router();

// Rate limiter for feedback submissions: max 10 per 15 mins per IP
const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: 'Too many feedback submissions. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/features', getPublicFeatureFlags);
router.post('/feedback', feedbackLimiter, optionalAuth, submitFeedback);

export default router;
