import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  createWordPack,
  getMyWordPacks,
  getPublicWordPacks,
  getWordPackById,
  updateWordPack,
  deleteWordPack,
  generateWordPackAI,
} from '../controllers/wordPackController.js';

const router = Router();

router.use(requireAuth);

router.post('/generate', generateWordPackAI);
router.get('/me', getMyWordPacks);
router.get('/public', getPublicWordPacks);
router.get('/:id', getWordPackById);
router.post('/', createWordPack);
router.put('/:id', updateWordPack);
router.patch('/:id', updateWordPack);
router.delete('/:id', deleteWordPack);

export default router;
