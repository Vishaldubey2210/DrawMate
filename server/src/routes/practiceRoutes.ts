import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getPracticeHealth, predictPracticeDrawing } from '../controllers/practiceController.js';

const router = Router();

router.get('/health', getPracticeHealth);
router.post('/predict', requireAuth, predictPracticeDrawing);

export default router;
