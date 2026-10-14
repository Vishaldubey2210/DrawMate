import { Server as SocketIOServer, Socket } from 'socket.io';
import { DrawingSessionManager } from '../../services/DrawingSessionManager.js';
import { RoomManager } from '../../services/RoomManager.js';
import { GameManager } from '../../game/GameManager.js';
import { normalizeRoomCode } from '../../utils/roomCode.js';
import {
  strokeStartSchema,
  strokePointsSchema,
  strokeEndSchema,
  undoSchema,
  clearSchema,
  getStateSchema,
  sessionInitSchema,
} from './drawing.schemas.js';

export function registerDrawingSocketHandlers(io: SocketIOServer, socket: Socket): void {
  const user = socket.data.user;
  if (!user) return;

  const drawingManager = DrawingSessionManager.getInstance();
  const roomManager = RoomManager.getInstance();

  /**
   * Helper to verify room membership (players for draw mutations, players & spectators for read state)
   */
  const verifyRoomMembership = (roomCode: string, allowSpectator: boolean = false): boolean => {
    const snapshot = roomManager.getSanitizedSnapshot(roomCode);
    if (!snapshot) return false;
    const isPlayer = snapshot.players.some((p) => p.userId === user.userId);
    if (isPlayer) return true;
    if (allowSpectator) {
      return snapshot.spectators.some((s) => s.userId === user.userId);
    }
    return false;
  };

  /**
   * Helper to verify if drawing session is isolated (Imposter Mode sequential drawing phase)
   */
  const isDrawingIsolated = (roomCode: string): boolean => {
    const game = GameManager.getInstance().getGame(roomCode);
    return Boolean(game && game.gameMode === 'imposter' && game.phase === 'imposter_drawing');
  };

  /**
   * Helper to verify if user is authorized to draw in this room:
   * During an active game, drawing authorization is strictly governed by GameManager.
   */
  const assertAuthorizedDrawer = (roomCode: string, requestedDrawerId?: string): void => {
    const game = GameManager.getInstance().getGame(roomCode);
    if (game && game.phase !== 'waiting' && game.phase !== 'game_over') {
      if (requestedDrawerId && requestedDrawerId !== game.currentDrawerId) {
        throw new Error('Unauthorized: Drawer assignment is authoritative while a game is active.');
      }
      if (user.userId !== game.currentDrawerId) {
        throw new Error('Unauthorized: Only the designated active drawer may perform drawing operations during an active game.');
      }
    }
  };

  /**
   * Initialize or configure a drawing session for testing or game rounds
   */
  socket.on('draw:session_init', (payload: any, ack?: (res: any) => void) => {
    try {
      const parsed = sessionInitSchema.parse(payload);
      const roomCode = normalizeRoomCode(parsed.roomCode);

      if (!verifyRoomMembership(roomCode)) {
        throw new Error('Unauthorized: You are not a participant in this room.');
      }

      assertAuthorizedDrawer(roomCode, parsed.drawerId);

      // Default drawer to specified drawer or current user
      const targetDrawerId = parsed.drawerId || user.userId;
      const session = drawingManager.setDrawer(roomCode, targetDrawerId);

      const snapshot = drawingManager.getSnapshot(roomCode)!;
      const response = { success: true, session: snapshot };

      if (typeof ack === 'function') ack(response);
      io.to(roomCode).emit('draw:state', snapshot);
    } catch (err: any) {
      const errorRes = { success: false, error: err.message || 'Failed to initialize drawing session.' };
      if (typeof ack === 'function') ack(errorRes);
      socket.emit('draw:error', errorRes);
    }
  });

  /**
   * Drawer starts a new stroke
   */
  socket.on('draw:stroke_start', (payload: any, ack?: (res: any) => void) => {
    try {
      const parsed = strokeStartSchema.parse(payload);
      const roomCode = normalizeRoomCode(parsed.roomCode);

      if (!verifyRoomMembership(roomCode)) {
        throw new Error('Unauthorized: You are not a participant in this room.');
      }

      assertAuthorizedDrawer(roomCode);

      const { stroke, revision } = drawingManager.startStroke(roomCode, user.userId, {
        strokeId: parsed.strokeId,
        tool: parsed.tool,
        color: parsed.color,
        width: parsed.width,
        point: parsed.point,
      });

      const response = { success: true, stroke, revision };
      if (typeof ack === 'function') ack(response);

      // Register drawer activity for fair-play / AFK monitoring
      GameManager.getInstance().getGame(roomCode)?.recordDrawerActivity(user.userId);

      // Broadcast to other participants in the room if not in isolated turn
      if (!isDrawingIsolated(roomCode)) {
        socket.to(roomCode).emit('draw:stroke_started', { stroke, revision });
      }
    } catch (err: any) {
      const errorRes = { success: false, error: err.message || 'Failed to start stroke.' };
      if (typeof ack === 'function') ack(errorRes);
      socket.emit('draw:error', errorRes);
    }
  });

  /**
   * Drawer appends intermediate points to active stroke
   */
  socket.on('draw:stroke_points', (payload: any, ack?: (res: any) => void) => {
    try {
      const parsed = strokePointsSchema.parse(payload);
      const roomCode = normalizeRoomCode(parsed.roomCode);

      if (!verifyRoomMembership(roomCode)) {
        throw new Error('Unauthorized: You are not a participant in this room.');
      }

      assertAuthorizedDrawer(roomCode);

      const { points, strokeId } = drawingManager.appendPoints(
        roomCode,
        user.userId,
        parsed.strokeId,
        parsed.points
      );

      const response = { success: true, strokeId, points };
      if (typeof ack === 'function') ack(response);

      // Register drawer activity for fair-play / AFK monitoring
      GameManager.getInstance().getGame(roomCode)?.recordDrawerActivity(user.userId);

      // Broadcast point batch to other observers if not in isolated turn
      if (!isDrawingIsolated(roomCode)) {
        socket.to(roomCode).emit('draw:stroke_update', { strokeId, points });
      }
    } catch (err: any) {
      const errorRes = { success: false, error: err.message || 'Failed to append points.' };
      if (typeof ack === 'function') ack(errorRes);
      socket.emit('draw:error', errorRes);
    }
  });

  /**
   * Drawer completes the stroke
   */
  socket.on('draw:stroke_end', (payload: any, ack?: (res: any) => void) => {
    try {
      const parsed = strokeEndSchema.parse(payload);
      const roomCode = normalizeRoomCode(parsed.roomCode);

      if (!verifyRoomMembership(roomCode)) {
        throw new Error('Unauthorized: You are not a participant in this room.');
      }

      assertAuthorizedDrawer(roomCode);

      const { completedStroke, revision } = drawingManager.endStroke(
        roomCode,
        user.userId,
        parsed.strokeId,
        parsed.points
      );

      const response = { success: true, completedStroke, revision };
      if (typeof ack === 'function') ack(response);

      // Broadcast completed stroke to other participants if not in isolated turn
      if (!isDrawingIsolated(roomCode)) {
        socket.to(roomCode).emit('draw:stroke_completed', { completedStroke, revision });
      }
    } catch (err: any) {
      const errorRes = { success: false, error: err.message || 'Failed to complete stroke.' };
      if (typeof ack === 'function') ack(errorRes);
      socket.emit('draw:error', errorRes);
    }
  });

  /**
   * Drawer undoes the last completed stroke
   */
  socket.on('draw:undo', (payload: any, ack?: (res: any) => void) => {
    try {
      const parsed = undoSchema.parse(payload);
      const roomCode = normalizeRoomCode(parsed.roomCode);

      if (!verifyRoomMembership(roomCode)) {
        throw new Error('Unauthorized: You are not a participant in this room.');
      }

      assertAuthorizedDrawer(roomCode);

      const { removedStrokeId, revision } = drawingManager.undo(roomCode, user.userId);

      const response = { success: true, removedStrokeId, revision };
      if (typeof ack === 'function') ack(response);

      // Broadcast undo to participants (or only drawer if isolated)
      if (isDrawingIsolated(roomCode)) {
        socket.emit('draw:undo_applied', { removedStrokeId, revision });
      } else {
        io.to(roomCode).emit('draw:undo_applied', { removedStrokeId, revision });
      }
    } catch (err: any) {
      const errorRes = { success: false, error: err.message || 'Failed to undo stroke.' };
      if (typeof ack === 'function') ack(errorRes);
      socket.emit('draw:error', errorRes);
    }
  });

  /**
   * Drawer redoes the last undone stroke
   */
  socket.on('draw:redo', (payload: any, ack?: (res: any) => void) => {
    try {
      const parsed = undoSchema.parse(payload);
      const roomCode = normalizeRoomCode(parsed.roomCode);

      if (!verifyRoomMembership(roomCode)) {
        throw new Error('Unauthorized: You are not a participant in this room.');
      }

      assertAuthorizedDrawer(roomCode);

      const { restoredStroke, revision } = drawingManager.redo(roomCode, user.userId);

      const response = { success: true, restoredStroke, revision };
      if (typeof ack === 'function') ack(response);

      // Broadcast redo to participants (or only drawer if isolated)
      if (isDrawingIsolated(roomCode)) {
        socket.emit('draw:redo_applied', { restoredStroke, revision });
      } else {
        io.to(roomCode).emit('draw:redo_applied', { restoredStroke, revision });
      }
    } catch (err: any) {
      const errorRes = { success: false, error: err.message || 'Failed to redo stroke.' };
      if (typeof ack === 'function') ack(errorRes);
      socket.emit('draw:error', errorRes);
    }
  });

  /**
   * Drawer clears the canvas
   */
  socket.on('draw:clear', (payload: any, ack?: (res: any) => void) => {
    try {
      const parsed = clearSchema.parse(payload);
      const roomCode = normalizeRoomCode(parsed.roomCode);

      if (!verifyRoomMembership(roomCode)) {
        throw new Error('Unauthorized: You are not a participant in this room.');
      }

      assertAuthorizedDrawer(roomCode);

      const { revision } = drawingManager.clear(roomCode, user.userId);

      const response = { success: true, revision };
      if (typeof ack === 'function') ack(response);

      // Broadcast clear to participants (or only drawer if isolated)
      if (isDrawingIsolated(roomCode)) {
        socket.emit('draw:canvas_cleared', { revision });
      } else {
        io.to(roomCode).emit('draw:canvas_cleared', { revision });
      }
    } catch (err: any) {
      const errorRes = { success: false, error: err.message || 'Failed to clear canvas.' };
      if (typeof ack === 'function') ack(errorRes);
      socket.emit('draw:error', errorRes);
    }
  });

  /**
   * Any authorized participant requests authoritative drawing snapshot
   */
  socket.on('draw:get_state', (payload: any, ack?: (res: any) => void) => {
    try {
      const parsed = getStateSchema.parse(payload);
      const roomCode = normalizeRoomCode(parsed.roomCode);

      if (!verifyRoomMembership(roomCode, true)) {
        throw new Error('Unauthorized: You are not a participant in this room.');
      }

      // Auto-initialize session if none exists yet, assigning room host as initial drawer
      const roomSnapshot = roomManager.getSanitizedSnapshot(roomCode);
      const defaultDrawer = roomSnapshot?.hostId || user.userId;
      const session = drawingManager.getOrCreateSession(roomCode, defaultDrawer);

      const snapshot = drawingManager.getSnapshot(roomCode)!;
      const response = { success: true, state: snapshot };

      if (typeof ack === 'function') ack(response);
      socket.emit('draw:state', snapshot);
    } catch (err: any) {
      const errorRes = { success: false, error: err.message || 'Failed to get canvas state.' };
      if (typeof ack === 'function') ack(errorRes);
      socket.emit('draw:error', errorRes);
    }
  });
}
