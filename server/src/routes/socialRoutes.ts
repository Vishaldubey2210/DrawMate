import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getFriends,
  getFriendRequests,
  sendFriendRequest,
  respondFriendRequest,
  cancelFriendRequest,
  removeFriend,
  blockUser,
  unblockUser,
  inviteFriend,
  searchUsers,
} from '../controllers/socialController.js';

const router = Router();

router.use(requireAuth);

router.get('/', getFriends);
router.get('/requests', getFriendRequests);
router.post('/request', sendFriendRequest);
router.post('/respond', respondFriendRequest);
router.post('/cancel', cancelFriendRequest);
router.delete('/:id', removeFriend);
router.post('/block', blockUser);
router.post('/unblock', unblockUser);
router.post('/invite', inviteFriend);
router.get('/search', searchUsers);

export default router;
