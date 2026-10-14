import { DrawingReplay, IDrawingReplay, IReplayEvent } from '../models/DrawingReplay.js';
import { GameManager } from '../game/GameManager.js';

interface ActiveRecordingSession {
  gameId: string;
  roomCode: string;
  roundNumber: number;
  drawerId: string;
  drawerDisplayName: string;
  secretWord: string;
  category: string;
  language: string;
  startedAt: number;
  events: IReplayEvent[];
}

export class ReplayRecorderService {
  private static instance: ReplayRecorderService;
  // Keyed by roomCode
  private activeRecordings: Map<string, ActiveRecordingSession> = new Map();

  private constructor() {}

  public static getInstance(): ReplayRecorderService {
    if (!ReplayRecorderService.instance) {
      ReplayRecorderService.instance = new ReplayRecorderService();
    }
    return ReplayRecorderService.instance;
  }

  /**
   * Starts a new chronological recording session for a round
   */
  public startRecording(params: {
    gameId: string;
    roomCode: string;
    roundNumber: number;
    drawerId: string;
    drawerDisplayName: string;
    secretWord: string;
    category?: string;
    language?: string;
  }): void {
    const session: ActiveRecordingSession = {
      gameId: params.gameId,
      roomCode: params.roomCode,
      roundNumber: params.roundNumber,
      drawerId: params.drawerId,
      drawerDisplayName: params.drawerDisplayName,
      secretWord: params.secretWord,
      category: params.category || 'general',
      language: params.language || 'en',
      startedAt: Date.now(),
      events: [],
    };

    this.activeRecordings.set(params.roomCode, session);
  }

  /**
   * Appends an accepted drawing event to the active recording session
   */
  public recordEvent(
    roomCode: string,
    type: 'stroke_start' | 'stroke_points' | 'stroke_end' | 'stroke_undo' | 'stroke_clear',
    data: any
  ): void {
    const session = this.activeRecordings.get(roomCode);
    if (!session) return;

    const offsetMs = Date.now() - session.startedAt;

    // Enforce reasonable upper bound of 10,000 events per round
    if (session.events.length < 10000) {
      session.events.push({
        type,
        offsetMs,
        data,
      });
    }
  }

  /**
   * Finalizes the active round recording and writes it to MongoDB
   */
  public async finalizeRecording(roomCode: string): Promise<IDrawingReplay | null> {
    const session = this.activeRecordings.get(roomCode);
    if (!session) return null;

    this.activeRecordings.delete(roomCode);

    const durationMs = Math.max(1000, Date.now() - session.startedAt);

    try {
      const replay = await DrawingReplay.create({
        gameId: session.gameId,
        roomCode: session.roomCode,
        roundNumber: session.roundNumber,
        drawerId: session.drawerId,
        drawerDisplayName: session.drawerDisplayName,
        secretWord: session.secretWord,
        category: session.category,
        language: session.language,
        durationMs,
        events: session.events,
      });

      return replay;
    } catch (err: any) {
      // Benign duplicate catch
      if (err.code !== 11000) {
        console.error('Failed to save drawing replay:', err);
      }
      return null;
    }
  }

  /**
   * Retrieves a completed round replay, ensuring active rounds do not leak secret words or strokes
   */
  public async getReplay(
    gameId: string,
    roundNumber: number
  ): Promise<{ replay: IDrawingReplay | null; error?: string }> {
    // Confidentiality check: ensure active round is not currently being played
    const gameManager = GameManager.getInstance();
    const activeGame = gameManager.getGameById(gameId);

    if (
      activeGame &&
      activeGame.currentRound === roundNumber &&
      (activeGame.phase === 'drawing' ||
        activeGame.phase === 'word_selection' ||
        activeGame.phase === 'imposter_drawing' ||
        activeGame.phase === 'imposter_voting')
    ) {
      return {
        replay: null,
        error: 'Replay access forbidden while this round is actively being played.',
      };
    }

    const replay = await DrawingReplay.findOne({ gameId, roundNumber });
    if (!replay) {
      return { replay: null, error: 'Replay not found for this round.' };
    }

    return { replay };
  }

  /**
   * Retrieves all available replays for a completed game
   */
  public async getGameReplays(gameId: string): Promise<IDrawingReplay[]> {
    return DrawingReplay.find({ gameId }).sort({ roundNumber: 1 });
  }
}
