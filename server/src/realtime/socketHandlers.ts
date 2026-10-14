import { Server as SocketIOServer, Socket } from 'socket.io';
import { RoomManager } from '../services/RoomManager.js';
import { createRoomSchema, updateRoomSettingsSchema } from '../schemas/roomSchemas.js';
import { AuthenticatedSocketUser } from './socketAuth.js';
import { normalizeRoomCode } from '../utils/roomCode.js';
import { GameManager } from '../game/GameManager.js';
import { DrawingSessionManager } from '../services/DrawingSessionManager.js';
import { AuditLog } from '../models/AuditLog.js';

export function registerRoomSocketHandlers(io: SocketIOServer, socket: Socket): void {
  const user = socket.data.user as AuthenticatedSocketUser;
  const roomManager = RoomManager.getInstance();

  if (!user) {
    socket.disconnect();
    return;
  }

  /**
   * Helper to broadcast fresh state to everyone in the room
   */
  const broadcastRoomState = (roomCode: string) => {
    const snapshot = roomManager.getSanitizedSnapshot(roomCode);
    if (snapshot) {
      io.to(roomCode).emit('room:state', snapshot);
    }
  };

  /**
   * Client creates a room
   */
  socket.on('room:create', async (payload: any, ack?: (res: any) => void) => {
    try {
      const parsed = createRoomSchema.parse(payload || {});
      const snapshot = await roomManager.createRoom(user, parsed, socket.id);

      socket.join(snapshot.roomCode);

      const response = { success: true, room: snapshot };
      if (typeof ack === 'function') ack(response);
      socket.emit('room:created', response);
      broadcastRoomState(snapshot.roomCode);
    } catch (err: any) {
      const errorResponse = { success: false, error: err.message || 'Failed to create room.' };
      if (typeof ack === 'function') ack(errorResponse);
      socket.emit('room:error', errorResponse);
    }
  });

  /**
   * Client joins a room by code
   */
  socket.on('room:join', async (payload: { roomCode: string }, ack?: (res: any) => void) => {
    try {
      const roomCode = normalizeRoomCode(payload?.roomCode);
      if (!roomCode) {
        throw new Error('Room code is required.');
      }

      const { snapshot, isReconnect } = await roomManager.joinRoom(roomCode, user, socket.id);

      socket.join(roomCode);

      const response = { success: true, room: snapshot, isReconnect };
      if (typeof ack === 'function') ack(response);

      socket.emit('room:joined', response);

      // Notify others in the room
      socket.to(roomCode).emit('room:player_joined', {
        user: {
          userId: user.userId,
          displayName: user.displayName,
          username: user.username,
          avatar: user.avatar,
        },
        isReconnect,
      });

      broadcastRoomState(roomCode);

      // On reconnection during an active match, deliver authoritative game & drawing states immediately
      if (isReconnect) {
        const activeGame = GameManager.getInstance().getGame(roomCode);
        if (activeGame) {
          const gameSnapshot = activeGame.getViewerSnapshot(user.userId);
          socket.emit('game:state', gameSnapshot);
        }

        const drawingSnapshot = DrawingSessionManager.getInstance().getSnapshot(roomCode);
        if (drawingSnapshot) {
          socket.emit('draw:state', drawingSnapshot);
        }
      }
    } catch (err: any) {
      const errorResponse = { success: false, error: err.message || 'Failed to join room.' };
      if (typeof ack === 'function') ack(errorResponse);
      socket.emit('room:error', errorResponse);
    }
  });

  /**
   * Client toggles ready status
   */
  socket.on('room:ready', (payload: any, ack?: (res: any) => void) => {
    try {
      if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid payload: roomCode and isReady are required.');
      }
      const roomCode = normalizeRoomCode(payload.roomCode);
      if (!roomCode) {
        throw new Error('Room code is required.');
      }
      const isReady = Boolean(payload.isReady);
      const snapshot = roomManager.setPlayerReady(roomCode, user.userId, isReady);

      const response = { success: true, isReady };
      if (typeof ack === 'function') ack(response);

      io.to(roomCode).emit('room:player_ready', {
        userId: user.userId,
        isReady: payload.isReady,
      });

      broadcastRoomState(roomCode);
    } catch (err: any) {
      const errorResponse = { success: false, error: err.message || 'Failed to set ready state.' };
      if (typeof ack === 'function') ack(errorResponse);
      socket.emit('room:error', errorResponse);
    }
  });

  /**
   * Host updates room settings
   */
  socket.on('room:update_settings', async (payload: { roomCode: string; settings: any }, ack?: (res: any) => void) => {
    try {
      const roomCode = normalizeRoomCode(payload?.roomCode);
      const validatedSettings = updateRoomSettingsSchema.parse(payload?.settings || {});

      const snapshot = await roomManager.updateSettings(roomCode, user.userId, validatedSettings);

      const response = { success: true, settings: snapshot.settings };
      if (typeof ack === 'function') ack(response);

      io.to(roomCode).emit('room:settings_updated', {
        settings: snapshot.settings,
        updatedBy: user.displayName,
      });

      broadcastRoomState(roomCode);
    } catch (err: any) {
      const errorResponse = { success: false, error: err.message || 'Failed to update settings.' };
      if (typeof ack === 'function') ack(errorResponse);
      socket.emit('room:error', errorResponse);
    }
  });

  /**
   * Host initiates game start validation
   */
  socket.on('room:start_request', async (payload: { roomCode: string }, ack?: (res: any) => void) => {
    try {
      const roomCode = normalizeRoomCode(payload?.roomCode);
      const validation = roomManager.validateStartRequest(roomCode, user.userId);

      if (!validation.canStart) {
        throw new Error(validation.error || 'Lobby is not ready to start.');
      }

      // Launch the authoritative multiplayer game session
      const snapshot = roomManager.getSanitizedSnapshot(roomCode)!;
      const activePlayers = snapshot.players
        .filter((p) => !p.isDisconnected)
        .map((p) => ({
          userId: p.userId,
          username: p.username,
          displayName: p.displayName,
          avatar: p.avatar,
        }));

      const game = await GameManager.getInstance().startGameAsync(
        roomCode,
        activePlayers,
        snapshot.settings,
        io
      );

      const response = {
        success: true,
        canStart: true,
        gameId: game.gameId,
        message: 'Game match started!',
      };

      if (typeof ack === 'function') ack(response);
      io.to(roomCode).emit('room:start_request_result', response);
      io.to(roomCode).emit('game:started', { gameId: game.gameId });
    } catch (err: any) {
      const errorResponse = { success: false, error: err.message || 'Cannot start room.' };
      if (typeof ack === 'function') ack(errorResponse);
      socket.emit('room:error', errorResponse);
    }
  });

  /**
   * Client joins a room as spectator
   */
  socket.on('room:join_spectator', async (payload: { roomCode: string }, ack?: (res: any) => void) => {
    try {
      const roomCode = normalizeRoomCode(payload?.roomCode);
      if (!roomCode) {
        throw new Error('Room code is required.');
      }

      const { snapshot, isReconnect } = await roomManager.joinRoomAsSpectator(roomCode, user, socket.id);

      socket.join(roomCode);

      const response = { success: true, room: snapshot, isSpectator: true, isReconnect };
      if (typeof ack === 'function') ack(response);

      socket.emit('room:joined_spectator', response);

      // Notify others in the room
      socket.to(roomCode).emit('room:spectator_joined', {
        user: {
          userId: user.userId,
          displayName: user.displayName,
          username: user.username,
          avatar: user.avatar,
        },
        isReconnect,
      });

      broadcastRoomState(roomCode);

      // If a game is active, also send sanitized spectator snapshot
      const activeGame = GameManager.getInstance().getGame(roomCode);
      if (activeGame) {
        const gameSnapshot = activeGame.getViewerSnapshot(user.userId);
        socket.emit('game:state', gameSnapshot);
      }
    } catch (err: any) {
      const errorResponse = { success: false, error: err.message || 'Failed to join as spectator.' };
      if (typeof ack === 'function') ack(errorResponse);
      socket.emit('room:error', errorResponse);
    }
  });

  /**
   * Spectator leaves room
   */
  socket.on('room:leave_spectator', async (payload: { roomCode: string }, ack?: (res: any) => void) => {
    try {
      const roomCode = normalizeRoomCode(payload?.roomCode);
      socket.leave(roomCode);

      await roomManager.handleSpectatorLeave(roomCode, user.userId);

      const response = { success: true };
      if (typeof ack === 'function') ack(response);
      socket.emit('room:left', response);

      io.to(roomCode).emit('room:spectator_left', {
        userId: user.userId,
        displayName: user.displayName,
      });

      broadcastRoomState(roomCode);
    } catch (err: any) {
      const errorResponse = { success: false, error: err.message || 'Error leaving spectator session.' };
      if (typeof ack === 'function') ack(errorResponse);
      socket.emit('room:error', errorResponse);
    }
  });

  /**
   * Permitted non-gameplay spectator chat message with AI moderation & anti-abuse guards
   */
  socket.on('chat:spectator_message', async (payload: { roomCode: string; text: string }, ack?: (res: any) => void) => {
    try {
      const roomCode = normalizeRoomCode(payload?.roomCode);
      const snapshot = roomManager.getSanitizedSnapshot(roomCode);
      if (!snapshot) throw new Error('Room not found.');

      const isSpectator = snapshot.spectators.some((s) => s.userId === user.userId);
      const isPlayer = snapshot.players.some((p) => p.userId === user.userId);

      if (!isSpectator && !isPlayer) {
        throw new Error('You are not in this room.');
      }

      const text = (payload?.text || '').trim();
      if (!text || text.length > 200) {
        throw new Error('Message must be between 1 and 200 characters.');
      }

      // 1. Abuse protection: deterministic rate limit & duplicate check
      const { AIModerationService } = await import('../services/AIModerationService.js');
      const rateCheck = AIModerationService.checkChatRateLimit(user.userId, roomCode, text);
      if (!rateCheck.allowed) {
        const errorRes = { success: false, error: rateCheck.error || 'Message blocked by rate limiter.' };
        if (typeof ack === 'function') ack(errorRes);
        socket.emit('chat:blocked', errorRes);
        return;
      }

      // 2. AI Content Moderation check
      const modResult = await AIModerationService.moderateChatMessage(text, user.userId, roomCode);
      if (!modResult.permitted) {
        const errorRes = {
          success: false,
          error: modResult.reason || 'Message blocked by moderation policy.',
          category: modResult.category,
        };
        if (typeof ack === 'function') ack(errorRes);
        socket.emit('chat:blocked', errorRes);
        return;
      }

      const message = {
        id: `spec_msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId: user.userId,
        displayName: user.displayName,
        text,
        isSpectator: true,
        timestamp: Date.now(),
      };

      io.to(roomCode).emit('chat:spectator_message', message);
      if (typeof ack === 'function') ack({ success: true, message });
    } catch (err: any) {
      const errorResponse = { success: false, error: err.message || 'Failed to send chat.' };
      if (typeof ack === 'function') ack(errorResponse);
      socket.emit('room:error', errorResponse);
    }
  });

  /**
   * Client requests full room snapshot
   */
  socket.on('room:get_state', (payload: { roomCode: string }, ack?: (res: any) => void) => {
    const roomCode = normalizeRoomCode(payload?.roomCode);
    const snapshot = roomManager.getSanitizedSnapshot(roomCode);

    if (!snapshot) {
      const errorRes = { success: false, error: 'Room not found.' };
      if (typeof ack === 'function') ack(errorRes);
      socket.emit('room:error', errorRes);
      return;
    }

    const response = { success: true, room: snapshot };
    if (typeof ack === 'function') ack(response);
    socket.emit('room:state', snapshot);
  });

  /**
   * Host kicks a player or spectator
   */
  socket.on(
    'room:kick_player',
    async (payload: { roomCode: string; targetUserId: string; reason?: string }, ack?: (res: any) => void) => {
      try {
        const roomCode = normalizeRoomCode(payload?.roomCode);
        const { snapshot, kickedSocketId } = await roomManager.kickPlayer(
          roomCode,
          user.userId,
          payload.targetUserId,
          payload.reason
        );

        if (kickedSocketId) {
          io.to(kickedSocketId).emit('room:kicked', {
            reason: payload.reason || 'You were removed by the room host.',
          });
          const targetSocket = io.sockets.sockets.get(kickedSocketId);
          if (targetSocket) {
            targetSocket.leave(roomCode);
          }
        }

        // Log audit event
        AuditLog.create({
          actorId: user.userId,
          action: 'ROOM_KICK_PLAYER',
          targetType: 'User',
          targetId: payload.targetUserId,
          reason: payload.reason || 'Host kick',
          metadata: { roomCode },
        }).catch(console.error);

        const response = { success: true };
        if (typeof ack === 'function') ack(response);

        io.to(roomCode).emit('room:player_kicked', {
          targetUserId: payload.targetUserId,
          kickedBy: user.displayName,
          reason: payload.reason,
        });

        broadcastRoomState(roomCode);
      } catch (err: any) {
        const errorResponse = { success: false, error: err.message || 'Failed to kick player.' };
        if (typeof ack === 'function') ack(errorResponse);
        socket.emit('room:error', errorResponse);
      }
    }
  );

  /**
   * Client explicitly leaves the room
   */
  socket.on('room:leave', async (payload: { roomCode: string }, ack?: (res: any) => void) => {
    try {
      const roomCode = normalizeRoomCode(payload?.roomCode);
      socket.leave(roomCode);

      const result = await roomManager.handlePlayerLeave(roomCode, user.userId, true);

      const response = { success: true };
      if (typeof ack === 'function') ack(response);
      socket.emit('room:left', response);

      if (result.roomClosed) {
        io.to(roomCode).emit('room:closed', { reason: 'Host closed the room or all players departed.' });
      } else {
        io.to(roomCode).emit('room:player_left', {
          userId: user.userId,
          displayName: user.displayName,
          newHostId: result.newHostId,
        });
        broadcastRoomState(roomCode);
      }
    } catch (err: any) {
      const errorResponse = { success: false, error: err.message || 'Error leaving room.' };
      if (typeof ack === 'function') ack(errorResponse);
      socket.emit('room:error', errorResponse);
    }
  });

  /**
   * Unexpected disconnect (network dropped or tab closed without clicking Leave)
   */
  socket.on('disconnect', async () => {
    const participation = roomManager.findUserRoom(user.userId, socket.id);
    if (!participation) return;

    const { roomCode, isSpectator } = participation;

    if (isSpectator) {
      await roomManager.handleSpectatorLeave(roomCode, user.userId);
      io.to(roomCode).emit('room:spectator_left', {
        userId: user.userId,
        displayName: user.displayName,
      });
      broadcastRoomState(roomCode);
      return;
    }

    // Handle unexpected disconnect with 30s grace period
    const result = await roomManager.handlePlayerLeave(
      roomCode,
      user.userId,
      false,
      (expiredSnapshot, departedUserId) => {
        // Expiration callback fired if grace period elapsed!
        if (!expiredSnapshot) {
          io.to(roomCode).emit('room:closed', { reason: 'All players departed.' });
        } else {
          io.to(roomCode).emit('room:player_left', {
            userId: departedUserId,
            reason: 'Disconnect grace period expired',
          });
          io.to(roomCode).emit('room:state', expiredSnapshot);
        }
      }
    );

    // Notify peers that player is temporarily disconnected
    io.to(roomCode).emit('room:player_presence', {
      userId: user.userId,
      isDisconnected: true,
      message: `${user.displayName} disconnected (reconnect grace period active)`,
    });

    broadcastRoomState(roomCode);
  });
}
