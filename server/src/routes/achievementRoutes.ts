import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getMyAchievements } from '../controllers/achievementController.js';

const router = Router();

router.use(requireAuth);

router.get('/my', getMyAchievements);

export default router;
