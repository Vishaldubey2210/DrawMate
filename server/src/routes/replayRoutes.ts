import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getRoundReplay, getMatchReplayList } from '../controllers/replayController.js';

const router = Router();

router.use(requireAuth);

router.get('/:gameId/:roundNumber', getRoundReplay);
router.get('/:gameId', getMatchReplayList);

export default router;
