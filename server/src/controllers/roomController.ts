import { Request, Response } from 'express';
import { RoomManager } from '../services/RoomManager.js';
import { normalizeRoomCode } from '../utils/roomCode.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { createRoomSchema } from '../schemas/roomSchemas.js';

export async function getPublicRooms(_req: Request, res: Response): Promise<void> {
  const roomManager = RoomManager.getInstance();
  const rooms = await roomManager.getPublicRoomsList();

  res.status(200).json({
    success: true,
    rooms,
    count: rooms.length,
  });
}

export async function checkRoom(req: Request, res: Response): Promise<void> {
  const roomCode = normalizeRoomCode(req.params.roomCode);
  const roomManager = RoomManager.getInstance();
  const room = await roomManager.getOrHydrateRoom(roomCode);

  if (!room || room.status === 'closed') {
    res.status(404).json({
      success: false,
      error: `Room "${roomCode}" was not found or has already ended.`,
    });
    return;
  }

  const isFull = room.players.size >= room.settings.maxPlayers;

  res.status(200).json({
    success: true,
    room: {
      roomCode: room.roomCode,
      name: room.name,
      visibility: room.visibility,
      status: room.status,
      currentPlayersCount: room.players.size,
      maxPlayers: room.settings.maxPlayers,
      isFull,
    },
  });
}

export async function createRoomHttp(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  const parsed = createRoomSchema.parse(req.body || {});
  const roomManager = RoomManager.getInstance();

  const snapshot = await roomManager.createRoom(
    {
      userId: user._id.toString(),
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
    },
    parsed,
    '' // No active socket ID yet; client connects via socket immediately after
  );

  res.status(201).json({
    success: true,
    room: snapshot,
  });
}
