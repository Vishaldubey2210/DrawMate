import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  updateUsername,
  checkUsername,
  getPublicProfile,
  getStatsSummary,
  rebuildStats,
  exportUserData,
} from '../controllers/profileController.js';
import { requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import {
  updateProfileSchema,
  updateUsernameSchema,
} from '../schemas/authSchemas.js';

const router = Router();

router.get('/me', requireAuth, getProfile);
router.patch('/me', requireAuth, validateRequest({ body: updateProfileSchema }), updateProfile);
router.patch('/username', requireAuth, validateRequest({ body: updateUsernameSchema }), updateUsername);
router.get('/check-username', checkUsername);
router.get('/stats/summary', requireAuth, getStatsSummary);
router.post('/stats/rebuild', requireAuth, rebuildStats);
router.get('/export', requireAuth, exportUserData);
router.get('/:username', getPublicProfile);

export default router;
