import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getMyMatches, getMatchDetails } from '../controllers/matchController.js';

const router = Router();

router.use(requireAuth);

router.get('/my', getMyMatches);
router.get('/:id', getMatchDetails);

export default router;
