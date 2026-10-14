import { Server as SocketIOServer } from 'socket.io';
import { Game, GamePlayer, GameSettings } from './Game.js';
import { SanitizedGameSnapshot, GuessMessage } from './game.types.js';
import { normalizeRoomCode } from '../utils/roomCode.js';
import { CustomWordPack } from '../models/CustomWordPack.js';
import { operationalMetrics } from '../services/OperationalMetrics.js';
import { telemetryService } from '../services/TelemetryService.js';

export class GameManager {
  private static instance: GameManager;
  private games: Map<string, Game> = new Map(); // Keyed by normalized roomCode

  private constructor() {}

  public static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager();
    }
    return GameManager.instance;
  }

  /**
   * Initializes and starts a new authoritative game session for a room
   */
  public startGame(
    rawCode: string,
    players: GamePlayer[],
    settings: GameSettings,
    io: SocketIOServer
  ): Game {
    const roomCode = normalizeRoomCode(rawCode);

    // If an existing game is still active, end it cleanly first
    const existing = this.games.get(roomCode);
    if (existing && existing.phase !== 'game_over' && existing.phase !== 'cancelled') {
      existing.cancelGame('Starting new match session');
    }

    const game = new Game(roomCode, players, settings, io);
    this.games.set(roomCode, game);
    game.start();

    operationalMetrics.recordMatchStarted();
    telemetryService.trackEvent({
      eventName: settings.gameMode === 'imposter' ? 'imposter_match_started' : 'classic_match_started',
      properties: {
        roomCode,
        playerCount: players.length,
        rounds: settings.rounds,
        hasCustomWordPack: Boolean(settings.customWordPackId),
      },
    });

    return game;
  }

  /**
   * Async version that resolves and freezes CustomWordPack snapshots if configured
   */
  public async startGameAsync(
    rawCode: string,
    players: GamePlayer[],
    settings: GameSettings,
    io: SocketIOServer
  ): Promise<Game> {
    const roomCode = normalizeRoomCode(rawCode);
    let customWords: string[] | undefined = settings.customWords;

    if (settings.customWordPackId && !customWords) {
      try {
        const pack = await CustomWordPack.findById(settings.customWordPackId);
        if (pack && pack.words) {
          customWords = [...pack.words];
        }
      } catch (err) {
        console.error('Failed to load custom word pack for game snapshot:', err);
      }
    }

    const resolvedSettings: GameSettings = {
      ...settings,
      customWords,
    };

    return this.startGame(roomCode, players, resolvedSettings, io);
  }

  /**
   * Retrieves the active game session for a room
   */
  public getGame(rawCode: string): Game | null {
    const roomCode = normalizeRoomCode(rawCode);
    return this.games.get(roomCode) || null;
  }

  /**
   * Retrieves an active game session by gameId
   */
  public getGameById(gameId: string): Game | null {
    for (const game of this.games.values()) {
      if (game.gameId === gameId) {
        return game;
      }
    }
    return null;
  }

  /**
   * Dispatches word selection from the active drawer
   */
  public handleWordSelect(rawCode: string, userId: string, word: string): void {
    const game = this.getGame(rawCode);
    if (!game) {
      throw new Error('No active game session found for this room.');
    }
    game.selectWord(userId, word);
  }

  /**
   * Dispatches a player guess
   */
  public handleGuess(rawCode: string, userId: string, text: string): { isCorrect: boolean; message: GuessMessage } {
    const game = this.getGame(rawCode);
    if (!game) {
      throw new Error('No active game session found for this room.');
    }
    return game.handleGuess(userId, text);
  }

  /**
   * Dispatches an authoritative Imposter Mode vote
   */
  public handleImposterVote(rawCode: string, voterUserId: string, targetUserId: string): boolean {
    const game = this.getGame(rawCode);
    if (!game) {
      throw new Error('No active game session found for this room.');
    }
    return game.submitImposterVote(voterUserId, targetUserId);
  }

  /**
   * Returns a sanitized viewer-specific snapshot
   */
  public getViewerSnapshot(rawCode: string, userId: string): SanitizedGameSnapshot | null {
    const game = this.getGame(rawCode);
    if (!game) return null;
    return game.getViewerSnapshot(userId);
  }

  /**
   * Cancels or removes an active game session (e.g. room closed or empty)
   */
  public removeGame(rawCode: string): void {
    const roomCode = normalizeRoomCode(rawCode);
    const game = this.games.get(roomCode);
    if (game) {
      game.cancelGame('Room terminated');
      this.games.delete(roomCode);
    }
  }
}
