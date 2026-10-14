import { Router } from 'express';
import {
  getSettings,
  updatePreferences,
  updateNotifications,
  updatePrivacy,
  changePassword,
  deleteAccount,
} from '../controllers/settingsController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, getSettings);
router.patch('/preferences', requireAuth, updatePreferences);
router.patch('/notifications', requireAuth, updateNotifications);
router.patch('/privacy', requireAuth, updatePrivacy);
router.post('/change-password', requireAuth, changePassword);
router.delete('/account', requireAuth, deleteAccount);

export default router;
