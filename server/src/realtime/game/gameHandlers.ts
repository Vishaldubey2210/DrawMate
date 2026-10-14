import { Server as SocketIOServer, Socket } from 'socket.io';
import { GameManager } from '../../game/GameManager.js';
import { RoomManager } from '../../services/RoomManager.js';
import { normalizeRoomCode } from '../../utils/roomCode.js';
import {
  gameStartSchema,
  wordSelectSchema,
  guessSchema,
  getGameStateSchema,
  imposterVoteSchema,
} from '../../game/game.schemas.js';

const guessRateLimits = new Map<string, { count: number; resetAt: number; lastGuess: string }>();

export function registerGameSocketHandlers(io: SocketIOServer, socket: Socket): void {
  const user = socket.data.user;
  if (!user) return;

  const gameManager = GameManager.getInstance();
  const roomManager = RoomManager.getInstance();

  /**
   * Helper to verify room membership (player or spectator)
   */
  const getRoomSnapshot = (roomCode: string) => {
    const snapshot = roomManager.getSanitizedSnapshot(roomCode);
    if (!snapshot) return null;
    const isPlayer = snapshot.players.some((p) => p.userId === user.userId);
    const isSpectator = snapshot.spectators.some((s) => s.userId === user.userId);
    return (isPlayer || isSpectator) ? snapshot : null;
  };

  /**
   * Host starts the game match
   */
  socket.on('game:start', async (payload: any, ack?: (res: any) => void) => {
    try {
      const parsed = gameStartSchema.parse(payload);
      const roomCode = normalizeRoomCode(parsed.roomCode);

      const room = getRoomSnapshot(roomCode);
      if (!room) {
        throw new Error('Unauthorized: You are not a participant in this room.');
      }

      if (room.hostId !== user.userId) {
        throw new Error('Unauthorized: Only the room host can start the game.');
      }

      const validation = roomManager.validateStartRequest(roomCode, user.userId);
      if (!validation.canStart) {
        throw new Error(validation.error || 'Lobby is not ready to start.');
      }

      // Filter connected players
      const activePlayers = room.players
        .filter((p) => !p.isDisconnected)
        .map((p) => ({
          userId: p.userId,
          username: p.username,
          displayName: p.displayName,
          avatar: p.avatar,
        }));

      // Initialize authoritative game session
      const game = await gameManager.startGameAsync(
        roomCode,
        activePlayers,
        {
          rounds: room.settings.rounds,
          drawTimeSeconds: room.settings.drawTimeSeconds,
          wordCount: room.settings.wordCount,
          hints: room.settings.hints,
          wordMode: room.settings.wordMode,
          category: room.settings.category,
          gameMode: room.settings.gameMode,
          wordLanguage: room.settings.wordLanguage,
          wordSource: room.settings.wordSource,
          customWordPackId: room.settings.customWordPackId,
        },
        io
      );

      const response = { success: true, gameId: game.gameId };
      if (typeof ack === 'function') ack(response);

      io.to(roomCode).emit('game:started', { gameId: game.gameId });
    } catch (err: any) {
      const errorRes = { success: false, error: err.message || 'Failed to start game.' };
      if (typeof ack === 'function') ack(errorRes);
      socket.emit('game:error', errorRes);
    }
  });

  /**
   * Drawer selects word choice
   */
  socket.on('game:word_select', (payload: any, ack?: (res: any) => void) => {
    try {
      const parsed = wordSelectSchema.parse(payload);
      const roomCode = normalizeRoomCode(parsed.roomCode);

      const room = getRoomSnapshot(roomCode);
      if (!room) {
        throw new Error('Unauthorized: You are not a participant in this room.');
      }

      if (room.spectators.some((s) => s.userId === user.userId)) {
        throw new Error('Unauthorized: Spectators cannot select words.');
      }

      gameManager.handleWordSelect(roomCode, user.userId, parsed.word);

      const response = { success: true };
      if (typeof ack === 'function') ack(response);
    } catch (err: any) {
      const errorRes = { success: false, error: err.message || 'Failed to select word.' };
      if (typeof ack === 'function') ack(errorRes);
      socket.emit('game:error', errorRes);
    }
  });

  /**
   * Guesser submits a guess
   */
  socket.on('game:guess', async (payload: any, ack?: (res: any) => void) => {
    try {
      const parsed = guessSchema.parse(payload);
      const roomCode = normalizeRoomCode(parsed.roomCode);

      const room = getRoomSnapshot(roomCode);
      if (!room) {
        throw new Error('Unauthorized: You are not a participant in this room.');
      }

      if (room.spectators.some((s) => s.userId === user.userId)) {
        throw new Error('Spectators cannot submit gameplay guesses.');
      }

      // If user already guessed correctly, fail with standard message
      const activeGame = gameManager.getGame(roomCode);
      if (activeGame && activeGame.guessedUserIds.has(user.userId)) {
        throw new Error('You have already guessed the word for this round.');
      }

      // Fair Play: Rate limiting (max 6 guesses / 5s) & consecutive duplicate guess suppression
      const now = Date.now();
      const rateKey = `${user.userId}:${roomCode}`;

      // Evict expired rate limit keys if registry exceeds capacity bound
      if (guessRateLimits.size > 2000) {
        for (const [k, v] of guessRateLimits.entries()) {
          if (now > v.resetAt) guessRateLimits.delete(k);
        }
      }

      const userLimit = guessRateLimits.get(rateKey) || { count: 0, resetAt: now + 5000, lastGuess: '' };

      if (now > userLimit.resetAt) {
        userLimit.count = 0;
        userLimit.resetAt = now + 5000;
      }

      if (userLimit.count >= 6) {
        throw new Error('Guess rate limit reached. Please wait a moment before guessing again.');
      }

      const normalizedGuess = parsed.text.trim().toLowerCase();
      if (userLimit.lastGuess && userLimit.lastGuess === normalizedGuess) {
        throw new Error('Duplicate guess ignored.');
      }

      userLimit.count += 1;
      userLimit.lastGuess = normalizedGuess;
      guessRateLimits.set(rateKey, userLimit);

      // AI content moderation guard on guesses
      const { AIModerationService } = await import('../../services/AIModerationService.js');
      const modCheck = await AIModerationService.moderateChatMessage(parsed.text, user.userId, roomCode);
      if (!modCheck.permitted) {
        throw new Error(modCheck.reason || 'Guess contains prohibited content.');
      }

      const result = gameManager.handleGuess(roomCode, user.userId, parsed.text);

      const response = { success: true, isCorrect: result.isCorrect };
      if (typeof ack === 'function') ack(response);
    } catch (err: any) {
      const errorRes = { success: false, error: err.message || 'Failed to submit guess.' };
      if (typeof ack === 'function') ack(errorRes);
      socket.emit('game:error', errorRes);
    }
  });

  /**
   * Participant fetches sanitized viewer-specific game state
   */
  socket.on('game:get_state', (payload: any, ack?: (res: any) => void) => {
    try {
      const parsed = getGameStateSchema.parse(payload);
      const roomCode = normalizeRoomCode(parsed.roomCode);

      const room = getRoomSnapshot(roomCode);
      if (!room) {
        throw new Error('Unauthorized: You are not a participant in this room.');
      }

      const snapshot = gameManager.getViewerSnapshot(roomCode, user.userId);
      const response = { success: true, game: snapshot };

      if (typeof ack === 'function') ack(response);
      if (snapshot) {
        socket.emit('game:state', snapshot);
      }
    } catch (err: any) {
      const errorRes = { success: false, error: err.message || 'Failed to get game state.' };
      if (typeof ack === 'function') ack(errorRes);
      socket.emit('game:error', errorRes);
    }
  });

  /**
   * Active player casts vote during Imposter Mode voting phase
   */
  socket.on('imposter:vote', (payload: any, ack?: (res: any) => void) => {
    try {
      const parsed = imposterVoteSchema.parse(payload);
      const roomCode = normalizeRoomCode(parsed.roomCode);

      const room = getRoomSnapshot(roomCode);
      if (!room) {
        throw new Error('Unauthorized: You are not a participant in this room.');
      }

      if (room.spectators.some((s) => s.userId === user.userId)) {
        throw new Error('Spectators cannot cast votes.');
      }

      gameManager.handleImposterVote(roomCode, user.userId, parsed.targetUserId);

      const response = { success: true };
      if (typeof ack === 'function') ack(response);
    } catch (err: any) {
      const errorRes = { success: false, error: err.message || 'Failed to cast vote.' };
      if (typeof ack === 'function') ack(errorRes);
      socket.emit('game:error', errorRes);
    }
  });
}
