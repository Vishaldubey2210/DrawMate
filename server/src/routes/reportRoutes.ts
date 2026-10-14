import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { submitReport, reportDrawing } from '../controllers/moderationController.js';

const router = Router();

router.post('/', requireAuth, submitReport);
router.post('/drawing', requireAuth, reportDrawing);

export default router;
