import { Router } from 'express';
import { getPublicRooms, checkRoom, createRoomHttp } from '../controllers/roomController.js';
import { requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { createRoomSchema } from '../schemas/roomSchemas.js';

const router = Router();

router.get('/public', getPublicRooms);
router.get('/:roomCode/check', checkRoom);
router.post('/', requireAuth, validateRequest({ body: createRoomSchema }), createRoomHttp);

export default router;
