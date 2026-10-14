import crypto from 'crypto';
import { Server as SocketIOServer } from 'socket.io';
import {
  GameMode,
  GamePhase,
  PlayerScore,
  GuessMessage,
  RoundSummary,
  SanitizedGameSnapshot,
  ImposterRevealDrawing,
  ImposterStateSnapshot,
} from './game.types.js';
import { WordService } from './WordService.js';
import { ScoringService } from './ScoringService.js';
import { HintService } from './HintService.js';
import { DrawingSessionManager } from '../services/DrawingSessionManager.js';
import { MatchResult } from '../models/MatchResult.js';
import { MatchHistoryService } from '../services/MatchHistoryService.js';
import { Room } from '../models/Room.js';
import { ReplayRecorderService } from '../services/ReplayRecorderService.js';
import { RoomManager } from '../services/RoomManager.js';
import { TelemetryService } from '../services/TelemetryService.js';
import { AuditLog } from '../models/AuditLog.js';

export interface GamePlayer {
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
}

export interface GameSettings {
  rounds: number;
  drawTimeSeconds: number;
  wordCount: number;
  hints: number;
  wordMode: 'normal' | 'hidden' | 'combination';
  category: string;
  gameMode?: GameMode;
  wordLanguage?: 'en' | 'hi' | 'es';
  wordSource?: 'builtin' | 'custom' | 'both';
  customWordPackId?: string | null;
  customWords?: string[];
}

export class Game {
  public readonly gameId: string;
  public readonly roomCode: string;
  public phase: GamePhase = 'waiting';
  public gameMode: GameMode = 'classic';

  public players: GamePlayer[];
  public scores: Map<string, PlayerScore> = new Map();

  public currentRound: number = 1;
  public totalRounds: number;
  public drawTimeSeconds: number;
  public wordCount: number;
  public hintsSetting: number;
  public wordMode: 'normal' | 'hidden' | 'combination';
  public category: string;
  public wordLanguage: 'en' | 'hi' | 'es';
  public wordSource: 'builtin' | 'custom' | 'both';
  public customWordPackId?: string | null;
  public customWordsSnapshot: string[] = [];

  public currentTurnIndex: number = 0;
  public currentDrawerId: string = '';
  public secretWord: string = '';
  public wordChoices: string[] = [];
  public revealedHintIndices: number[] = [];

  public recentGuesses: GuessMessage[] = [];
  public guessedUserIds: Set<string> = new Set();
  public lastRoundSummary?: RoundSummary;

  // Imposter Mode authoritative properties
  public imposterUserId: string = '';
  public categoryClue: string = '';
  public imposterDrawingTurnIndex: number = 0;
  public imposterRevealedDrawings: ImposterRevealDrawing[] = [];
  public imposterVotes: Map<string, string> = new Map();
  public wasImposterCaught: boolean = false;
  public voteTallies: Record<string, number> = {};
  public votersForImposter: string[] = [];

  public timerStartedAt: number = 0;
  public timerDeadline: number = 0;
  public timerDurationSeconds: number = 0;

  public lastDrawerActivityTime: number = 0;
  public afkWarningIssued: boolean = false;
  private afkWarningTimer?: NodeJS.Timeout;
  private afkSkipTimer?: NodeJS.Timeout;

  private activeTimer?: NodeJS.Timeout;
  private hintTimeouts: NodeJS.Timeout[] = [];
  public revision: number = 0;
  private usedWords: string[] = [];

  private io: SocketIOServer;
  private isFinalized: boolean = false;

  constructor(
    roomCode: string,
    players: GamePlayer[],
    settings: GameSettings,
    io: SocketIOServer
  ) {
    this.gameId = `game_${crypto.randomUUID()}`;
    this.roomCode = roomCode;
    this.players = [...players];
    this.totalRounds = settings.rounds;
    this.drawTimeSeconds = settings.drawTimeSeconds;
    this.wordCount = settings.wordCount;
    this.hintsSetting = settings.hints;
    this.wordMode = settings.wordMode;
    this.category = settings.category;
    this.gameMode = settings.gameMode || 'classic';
    this.wordLanguage = settings.wordLanguage || 'en';
    this.wordSource = settings.wordSource || 'builtin';
    this.customWordPackId = settings.customWordPackId;
    this.customWordsSnapshot = settings.customWords ? [...settings.customWords] : [];
    this.io = io;

    // Initialize player score records
    for (const p of this.players) {
      this.scores.set(p.userId, {
        userId: p.userId,
        username: p.username,
        displayName: p.displayName,
        avatar: p.avatar,
        score: 0,
        roundScore: 0,
        correctGuesses: 0,
        drawingTurns: 0,
      });
    }
  }

  /**
   * Starts the game session and launches the first turn
   */
  public start(): void {
    if (this.phase !== 'waiting') return;

    this.currentRound = 1;
    this.currentTurnIndex = 0;
    this.revision += 1;

    // Persist and synchronize room in_game status
    RoomManager.getInstance().setRoomStatus(this.roomCode, 'in_game');

    if (this.gameMode === 'imposter') {
      if (this.players.length < 4) {
        throw new Error('Imposter Mode requires at least 4 active players.');
      }
      this.startImposterRound();
    } else {
      this.startTurn();
    }
  }

  /**
   * Begins a new turn with word selection
   */
  public startTurn(): void {
    this.clearAllTimers();

    const drawer = this.players[this.currentTurnIndex];
    if (!drawer) {
      this.endGame();
      return;
    }

    this.currentDrawerId = drawer.userId;
    this.secretWord = '';
    this.revealedHintIndices = [];
    this.guessedUserIds.clear();
    this.phase = 'word_selection';
    this.revision += 1;

    // Reset round scores for players
    for (const record of this.scores.values()) {
      record.roundScore = 0;
    }

    // Generate word choices for drawer with language, mode, and custom pack snapshot
    this.wordChoices = WordService.getWordChoices({
      category: this.category,
      count: this.wordCount,
      excludeWords: this.usedWords,
      language: this.wordLanguage,
      wordMode: this.wordMode,
      wordSource: this.wordSource,
      customWords: this.customWordsSnapshot,
    });

    // Start 15s word selection timer
    const selectionDurationSeconds = 15;
    this.timerDurationSeconds = selectionDurationSeconds;
    this.timerStartedAt = Date.now();
    this.timerDeadline = this.timerStartedAt + selectionDurationSeconds * 1000;

    this.activeTimer = setTimeout(() => {
      // Auto-pick first word choice on timeout
      if (this.phase === 'word_selection') {
        const fallbackWord = this.wordChoices[0] || 'apple';
        this.selectWord(this.currentDrawerId, fallbackWord);
      }
    }, selectionDurationSeconds * 1000);

    this.broadcastViewerSnapshots();
  }

  /**
   * Drawer selects a word from the offered choices
   */
  public selectWord(userId: string, chosenWord: string): void {
    if (this.phase !== 'word_selection') {
      throw new Error('Game is not in word selection phase.');
    }

    if (this.currentDrawerId !== userId) {
      throw new Error('Unauthorized: Only the current drawer can select a word.');
    }

    const matchedChoice = this.wordChoices.find(
      (w) => w.toLowerCase() === chosenWord.toLowerCase().trim()
    );

    if (!matchedChoice) {
      throw new Error('Invalid word choice: Selected word was not offered.');
    }

    this.clearAllTimers();
    this.secretWord = matchedChoice;
    this.usedWords.push(matchedChoice.toLowerCase());
    this.wordChoices = [];
    this.phase = 'drawing';
    this.revision += 1;

    // Grant canvas authorization to drawer in Phase 3 DrawingSessionManager and clear old canvas
    const drawingManager = DrawingSessionManager.getInstance();
    drawingManager.setDrawer(this.roomCode, this.currentDrawerId);
    drawingManager.clear(this.roomCode, this.currentDrawerId);

    // Notify room that drawing canvas is ready
    this.io.to(this.roomCode).emit('draw:canvas_cleared', { revision: 1 });

    // Begin chronological drawing replay recording
    const drawer = this.players.find((p) => p.userId === this.currentDrawerId);
    ReplayRecorderService.getInstance().startRecording({
      gameId: this.gameId,
      roomCode: this.roomCode,
      roundNumber: this.currentRound,
      drawerId: this.currentDrawerId,
      drawerDisplayName: drawer?.displayName || 'Drawer',
      secretWord: this.secretWord,
      category: this.category,
      language: this.wordLanguage,
    });

    // Set drawing turn timer
    this.timerDurationSeconds = this.drawTimeSeconds;
    this.timerStartedAt = Date.now();
    this.timerDeadline = this.timerStartedAt + this.drawTimeSeconds * 1000;

    // Initialize AFK activity tracking
    this.lastDrawerActivityTime = Date.now();
    this.afkWarningIssued = false;
    this.scheduleAfkCheck();

    this.activeTimer = setTimeout(() => {
      if (this.phase === 'drawing') {
        this.endRound('timeout');
      }
    }, this.drawTimeSeconds * 1000);

    // Schedule progressive hints
    this.scheduleHints();

    this.broadcastViewerSnapshots();
  }

  /**
   * Schedules drawer inactivity checks and warning countdowns
   */
  private scheduleAfkCheck(): void {
    if (this.afkWarningTimer) clearTimeout(this.afkWarningTimer);
    if (this.afkSkipTimer) clearTimeout(this.afkSkipTimer);

    // Threshold: 20 seconds, or 35% of total draw time
    const warningDelayMs = Math.min(20000, Math.max(8000, this.drawTimeSeconds * 1000 * 0.35));

    this.afkWarningTimer = setTimeout(() => {
      if (this.phase !== 'drawing') return;

      const idleDuration = Date.now() - this.lastDrawerActivityTime;
      if (idleDuration >= warningDelayMs && !this.afkWarningIssued) {
        this.afkWarningIssued = true;
        const countdownSeconds = 10;

        this.io.to(this.roomCode).emit('game:afk_warning', {
          drawerId: this.currentDrawerId,
          countdownSeconds,
          message: 'Drawer appears inactive! Turn will be skipped in 10s if no drawing activity is detected.',
        });

        // Countdown before turn skip
        this.afkSkipTimer = setTimeout(() => {
          if (this.phase === 'drawing' && this.afkWarningIssued) {
            this.io.to(this.roomCode).emit('game:afk_turn_skipped', {
              drawerId: this.currentDrawerId,
              message: 'Turn skipped due to drawer inactivity (AFK).',
            });

            AuditLog.create({
              actorId: 'system',
              action: 'AFK_TURN_SKIPPED',
              targetType: 'User',
              targetId: this.currentDrawerId,
              reason: 'Drawer inactivity during drawing turn',
              metadata: { roomCode: this.roomCode, gameId: this.gameId, round: this.currentRound },
            }).catch(console.error);

            this.endRound('afk_skip');
          }
        }, countdownSeconds * 1000);
      }
    }, warningDelayMs);
  }

  /**
   * Records authoritative drawer activity from valid canvas strokes
   */
  public recordDrawerActivity(userId: string): void {
    if (this.phase !== 'drawing' || userId !== this.currentDrawerId) return;

    this.lastDrawerActivityTime = Date.now();
    if (this.afkWarningIssued) {
      this.afkWarningIssued = false;
      if (this.afkSkipTimer) {
        clearTimeout(this.afkSkipTimer);
        this.afkSkipTimer = undefined;
      }
      this.io.to(this.roomCode).emit('game:afk_cleared', {
        drawerId: this.currentDrawerId,
      });
    }
  }

  /**
   * Schedules progressive hint callbacks across turn duration
   */
  private scheduleHints(): void {
    this.hintTimeouts.forEach((t) => clearTimeout(t));
    this.hintTimeouts = [];

    // In Hidden Mode, no progressive hints are revealed to guessers!
    if (this.hintsSetting <= 0 || this.wordMode === 'hidden') return;

    const offsets = HintService.calculateHintOffsets(this.drawTimeSeconds, this.hintsSetting);

    for (const offsetMs of offsets) {
      const timeout = setTimeout(() => {
        if (this.phase === 'drawing' && this.secretWord) {
          const nextIndex = HintService.revealNextCharacter(this.secretWord, this.revealedHintIndices);
          if (nextIndex !== null) {
            this.revealedHintIndices.push(nextIndex);
            this.revision += 1;

            this.io.to(this.roomCode).emit('game:hint_revealed', {
              masked: WordService.generateMask(this.secretWord, this.revealedHintIndices, this.wordMode),
              revealedIndex: nextIndex,
            });

            this.broadcastViewerSnapshots();
          }
        }
      }, offsetMs);

      this.hintTimeouts.push(timeout);
    }
  }

  /**
   * Processes player guess
   */
  public handleGuess(userId: string, rawText: string): { isCorrect: boolean; message: GuessMessage } {
    if (this.phase !== 'drawing') {
      throw new Error('Guesses can only be submitted during the active drawing phase.');
    }

    if (this.currentDrawerId === userId) {
      throw new Error('Drawer cannot submit guesses.');
    }

    const player = this.players.find((p) => p.userId === userId);
    if (!player) {
      throw new Error('You are not a participant in this game.');
    }

    const text = rawText.trim();
    if (!text) {
      throw new Error('Guess cannot be empty.');
    }

    // If player already guessed correctly in this round, ignore further guesses
    if (this.guessedUserIds.has(userId)) {
      throw new Error('You have already guessed the word for this round.');
    }

    const isCorrect = WordService.isMatch(text, this.secretWord, [], this.wordLanguage);

    const message: GuessMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      displayName: player.displayName,
      text: isCorrect ? 'Guessed the secret word!' : text,
      isCorrect,
      timestamp: Date.now(),
    };

    this.recentGuesses.push(message);
    if (this.recentGuesses.length > 50) {
      this.recentGuesses.shift();
    }

    if (isCorrect) {
      this.guessedUserIds.add(userId);

      // Calculate score based on time remaining
      const timeRemaining = Math.max(0, (this.timerDeadline - Date.now()) / 1000);
      const guesserPoints = ScoringService.calculateGuesserScore(timeRemaining, this.drawTimeSeconds);
      const drawerBonus = ScoringService.calculateDrawerBonus();

      const guesserScore = this.scores.get(userId);
      if (guesserScore) {
        guesserScore.score += guesserPoints;
        guesserScore.roundScore += guesserPoints;
        guesserScore.correctGuesses += 1;
      }

      const drawerScore = this.scores.get(this.currentDrawerId);
      if (drawerScore) {
        drawerScore.score += drawerBonus;
        drawerScore.roundScore += drawerBonus;
      }

      this.io.to(this.roomCode).emit('game:player_guessed', {
        userId,
        displayName: player.displayName,
        points: guesserPoints,
        drawerBonus,
      });

      // End round on valid correct guess
      this.endRound('guessed', player);
    } else {
      // Broadcast guess message to room
      this.io.to(this.roomCode).emit('game:guess_result', message);
    }

    return { isCorrect, message };
  }

  /**
   * Finalizes the current round/turn and triggers round summary
   */
  public endRound(reason: 'guessed' | 'timeout' | 'cancelled' | 'afk_skip', winnerPlayer?: GamePlayer): void {
    if (this.phase === 'round_ending' || this.phase === 'game_over') return;

    const roundDurationSeconds = Math.max(0, Math.round((Date.now() - this.timerStartedAt) / 1000));

    this.clearAllTimers();
    this.phase = 'round_ending';
    this.revision += 1;

    // Record round telemetry for smart word selection and difficulty modeling
    TelemetryService.recordRound({
      gameId: this.gameId,
      roomCode: this.roomCode,
      roundNumber: this.currentRound,
      word: this.secretWord,
      category: this.category,
      language: this.wordLanguage,
      declaredDifficulty: 'medium',
      roundDurationSeconds,
      timeToFirstCorrectGuessSeconds: reason === 'guessed' ? roundDurationSeconds : null,
      totalGuessesCount: this.recentGuesses.length,
      correctGuessersCount: this.guessedUserIds.size,
      incorrectGuessesCount: Math.max(0, this.recentGuesses.length - this.guessedUserIds.size),
      timedOut: reason === 'timeout',
      solved: this.guessedUserIds.size > 0,
      eligiblePlayersCount: this.players.length,
      isAfkSkip: reason === 'afk_skip',
      isCancelled: reason === 'cancelled',
    }).catch(console.error);

    // Revoke drawer privileges in Phase 3 DrawingSessionManager
    DrawingSessionManager.getInstance().setDrawer(this.roomCode, '');

    const drawer = this.players.find((p) => p.userId === this.currentDrawerId);
    const drawerRecord = this.scores.get(this.currentDrawerId);
    if (drawerRecord) {
      drawerRecord.drawingTurns += 1;
    }

    const pointsAwarded: Record<string, number> = {};
    for (const [uid, record] of this.scores.entries()) {
      pointsAwarded[uid] = record.roundScore;
    }

    this.lastRoundSummary = {
      roundNumber: this.currentRound,
      drawerId: this.currentDrawerId,
      drawerName: drawer?.displayName || 'Drawer',
      secretWord: this.secretWord,
      winnerId: winnerPlayer?.userId,
      winnerName: winnerPlayer?.displayName,
      reason,
      pointsAwarded,
    };

    this.io.to(this.roomCode).emit('game:round_ended', this.lastRoundSummary);
    this.broadcastViewerSnapshots();

    // Finalize chronological drawing replay recording
    ReplayRecorderService.getInstance().finalizeRecording(this.roomCode).catch(console.error);

    // After 6 seconds of round summary screen, proceed to next turn or game over
    const summaryDurationSeconds = 6;
    this.timerDurationSeconds = summaryDurationSeconds;
    this.timerStartedAt = Date.now();
    this.timerDeadline = this.timerStartedAt + summaryDurationSeconds * 1000;

    this.activeTimer = setTimeout(() => {
      this.proceedToNextTurn();
    }, summaryDurationSeconds * 1000);
  }

  /**
   * Advances turn rotation or finishes the game
   */
  private proceedToNextTurn(): void {
    this.currentTurnIndex += 1;

    // If all players drew in this round, advance round counter
    if (this.currentTurnIndex >= this.players.length) {
      this.currentTurnIndex = 0;
      this.currentRound += 1;
    }

    if (this.currentRound > this.totalRounds) {
      this.endGame();
    } else {
      this.startTurn();
    }
  }

  /**
   * Concludes the game, calculates final rankings, and saves MatchResult
   */
  public endGame(): void {
    if (this.isFinalized) return;
    this.isFinalized = true;

    this.clearAllTimers();
    this.phase = 'game_over';
    this.revision += 1;

    // Finalize any active recording
    ReplayRecorderService.getInstance().finalizeRecording(this.roomCode).catch(console.error);

    // Calculate leaderboard sorted by score descending
    const sortedScores = Array.from(this.scores.values()).sort((a, b) => b.score - a.score);
    const topScore = sortedScores[0]?.score ?? 0;
    const tiedWinners = sortedScores.filter((s) => s.score === topScore);

    const winnerInfo = {
      userId: sortedScores[0]?.userId || '',
      displayName: tiedWinners.length > 1
        ? tiedWinners.map((w) => w.displayName).join(' & ')
        : sortedScores[0]?.displayName || 'Winner',
      score: topScore,
      isTie: tiedWinners.length > 1,
    };

    // Persist MatchResult and update player stats/achievements via MatchHistoryService
    const playersRanked = sortedScores.map((p, index) => ({
      userId: p.userId,
      username: p.username,
      displayName: p.displayName,
      avatar: p.avatar,
      score: p.score,
      rank: index + 1,
      correctGuesses: p.correctGuesses,
      drawingTurns: p.drawingTurns,
    }));

    MatchHistoryService.finalizeMatch({
      gameId: this.gameId,
      roomCode: this.roomCode,
      rounds: this.totalRounds,
      category: this.category,
      players: playersRanked,
      winner: {
        userId: sortedScores[0]?.userId || '',
        displayName: winnerInfo.displayName,
        score: topScore,
      },
      startedAt: new Date(Date.now() - 300000),
      completedAt: new Date(),
    }).catch(console.error);

    // Update Room status back to waiting for next match
    RoomManager.getInstance().setRoomStatus(this.roomCode, 'waiting');

    this.io.to(this.roomCode).emit('game:over', {
      winner: winnerInfo,
      leaderboard: sortedScores,
    });

    this.broadcastViewerSnapshots();
  }

  /**
   * Cancels the active game in case of unrecoverable player departure
   */
  public cancelGame(reason: string): void {
    if (this.isFinalized) return;
    this.isFinalized = true;

    this.clearAllTimers();
    this.phase = 'cancelled';
    this.revision += 1;

    // Finalize recording
    ReplayRecorderService.getInstance().finalizeRecording(this.roomCode).catch(console.error);

    const playersRanked = Array.from(this.scores.values()).map((p, index) => ({
      userId: p.userId,
      username: p.username,
      displayName: p.displayName,
      avatar: p.avatar,
      score: p.score,
      rank: index + 1,
      correctGuesses: p.correctGuesses,
      drawingTurns: p.drawingTurns,
    }));

    MatchHistoryService.recordCancelledMatch(
      this.gameId,
      this.roomCode,
      this.totalRounds,
      playersRanked
    ).catch(console.error);

    Room.updateOne({ roomCode: this.roomCode }, { status: 'waiting' }).catch(console.error);

    this.io.to(this.roomCode).emit('game:cancelled', { reason });
    this.broadcastViewerSnapshots();
  }

  /**
   * Starts an Imposter Mode round: assigns 1 secret imposter and starts sequential drawing turns
   */
  public startImposterRound(): void {
    this.clearAllTimers();
    this.imposterVotes.clear();
    this.imposterRevealedDrawings = [];
    this.imposterDrawingTurnIndex = 0;
    this.revision += 1;

    // Reset round scores for players
    for (const record of this.scores.values()) {
      record.roundScore = 0;
    }

    // 1. Authoritative Imposter selection: exactly 1 imposter at random
    const imposterIndex = Math.floor(Math.random() * this.players.length);
    this.imposterUserId = this.players[imposterIndex].userId;

    // 2. Select 1 target word and category clue
    const wordChoices = WordService.getWordChoices({
      category: this.category,
      count: 1,
      excludeWords: this.usedWords,
      language: this.wordLanguage,
      wordMode: 'normal',
      wordSource: this.wordSource,
      customWords: this.customWordsSnapshot,
    });
    this.secretWord = wordChoices[0] || 'airplane';
    this.usedWords.push(this.secretWord);
    this.categoryClue = this.category && this.category !== 'general'
      ? this.category.toUpperCase()
      : 'EVERYDAY OBJECTS';

    this.startNextImposterDrawingTurn();
  }

  /**
   * Begins an isolated, timed drawing turn for the current player in turn order
   */
  public startNextImposterDrawingTurn(): void {
    this.clearAllTimers();

    if (this.imposterDrawingTurnIndex >= this.players.length) {
      // All players completed their isolated drawings -> transition to reveal & voting
      this.startImposterVoting();
      return;
    }

    const drawer = this.players[this.imposterDrawingTurnIndex];
    this.currentDrawerId = drawer.userId;
    this.phase = 'imposter_drawing';
    this.revision += 1;

    // Isolate canvas: clear drawing session for the new drawer
    DrawingSessionManager.getInstance().clearCanvas(this.roomCode, drawer.userId);
    DrawingSessionManager.getInstance().setDrawer(this.roomCode, drawer.userId);

    // Configurable server-authoritative drawing timer (e.g. 20-30s per player)
    const turnDurationSeconds = Math.max(15, Math.min(45, Math.floor(this.drawTimeSeconds / this.players.length)));
    this.timerDurationSeconds = turnDurationSeconds;
    this.timerStartedAt = Date.now();
    this.timerDeadline = this.timerStartedAt + turnDurationSeconds * 1000;

    this.activeTimer = setTimeout(() => {
      this.finalizeImposterDrawingTurn();
    }, turnDurationSeconds * 1000);

    this.broadcastViewerSnapshots();
  }

  /**
   * Finalizes the current player's drawing turn and records their drawing
   */
  public finalizeImposterDrawingTurn(): void {
    this.clearAllTimers();

    const drawer = this.players[this.imposterDrawingTurnIndex];
    if (drawer) {
      const session = DrawingSessionManager.getInstance().getSession(this.roomCode);
      const strokes = session ? [...session.strokes] : [];
      this.imposterRevealedDrawings.push({
        turnIndex: this.imposterDrawingTurnIndex + 1,
        drawerId: drawer.userId,
        drawerName: drawer.displayName,
        strokes,
      });

      const drawerScore = this.scores.get(drawer.userId);
      if (drawerScore) {
        drawerScore.drawingTurns += 1;
      }
    }

    this.imposterDrawingTurnIndex += 1;
    this.startNextImposterDrawingTurn();
  }

  /**
   * Starts the timed reveal & voting phase
   */
  public startImposterVoting(): void {
    this.clearAllTimers();
    this.phase = 'imposter_voting';
    this.currentDrawerId = '';
    DrawingSessionManager.getInstance().setDrawer(this.roomCode, '');
    this.revision += 1;

    // Timed voting phase (30 seconds)
    const voteDurationSeconds = 30;
    this.timerDurationSeconds = voteDurationSeconds;
    this.timerStartedAt = Date.now();
    this.timerDeadline = this.timerStartedAt + voteDurationSeconds * 1000;

    this.activeTimer = setTimeout(() => {
      this.finalizeImposterVoting();
    }, voteDurationSeconds * 1000);

    this.broadcastViewerSnapshots();
  }

  /**
   * Submits a player's authoritative vote for the suspected imposter
   */
  public submitImposterVote(voterUserId: string, targetUserId: string): boolean {
    if (this.phase !== 'imposter_voting') {
      throw new Error('Voting phase is not active.');
    }

    const isVoterPlayer = this.players.some((p) => p.userId === voterUserId);
    if (!isVoterPlayer) {
      throw new Error('Only active players may cast votes.');
    }

    if (voterUserId === targetUserId) {
      throw new Error('You cannot vote for yourself.');
    }

    const isTargetPlayer = this.players.some((p) => p.userId === targetUserId);
    if (!isTargetPlayer) {
      throw new Error('Invalid vote target: target must be a player in this room.');
    }

    if (this.imposterVotes.has(voterUserId)) {
      throw new Error('You have already cast your vote for this round.');
    }

    this.imposterVotes.set(voterUserId, targetUserId);
    this.revision += 1;

    // If all active players have submitted their votes, advance immediately
    if (this.imposterVotes.size >= this.players.length) {
      this.finalizeImposterVoting();
    } else {
      this.broadcastViewerSnapshots();
    }

    return true;
  }

  /**
   * Finalizes voting, calculates tallies, applies scoring, and transitions to results
   */
  public finalizeImposterVoting(): void {
    this.clearAllTimers();
    this.phase = 'imposter_results';
    this.revision += 1;

    // 1. Calculate vote counts
    const tallies: Record<string, number> = {};
    for (const p of this.players) {
      tallies[p.userId] = 0;
    }
    for (const targetId of this.imposterVotes.values()) {
      tallies[targetId] = (tallies[targetId] || 0) + 1;
    }
    this.voteTallies = tallies;

    // 2. Identify highest-voted candidate
    let maxVotes = 0;
    let candidateIds: string[] = [];
    for (const [userId, count] of Object.entries(tallies)) {
      if (count > maxVotes) {
        maxVotes = count;
        candidateIds = [userId];
      } else if (count === maxVotes && maxVotes > 0) {
        candidateIds.push(userId);
      }
    }

    // Tie handling: if multiple players share top votes or 0 votes cast, tie -> no clear identification
    const isTie = candidateIds.length !== 1 || maxVotes === 0;
    const highestVotedId = isTie ? '' : candidateIds[0];
    this.wasImposterCaught = highestVotedId === this.imposterUserId;

    // 3. Award points
    this.votersForImposter = [];
    for (const [voterId, targetId] of this.imposterVotes.entries()) {
      if (targetId === this.imposterUserId) {
        this.votersForImposter.push(voterId);
        const voterScore = this.scores.get(voterId);
        if (voterScore) {
          voterScore.score += 150;
          voterScore.roundScore = 150;
          voterScore.correctGuesses += 1;
        }
      }
    }

    const imposterScore = this.scores.get(this.imposterUserId);
    if (imposterScore) {
      if (!this.wasImposterCaught) {
        // Evasion bonus: 300 points
        imposterScore.score += 300;
        imposterScore.roundScore = (imposterScore.roundScore || 0) + 300;
      }
    }

    // 4. Results duration: 10 seconds before next round or game over
    const resultsDurationSeconds = 10;
    this.timerDurationSeconds = resultsDurationSeconds;
    this.timerStartedAt = Date.now();
    this.timerDeadline = this.timerStartedAt + resultsDurationSeconds * 1000;

    this.activeTimer = setTimeout(() => {
      if (this.currentRound >= this.totalRounds) {
        this.endGame();
      } else {
        this.currentRound += 1;
        this.startImposterRound();
      }
    }, resultsDurationSeconds * 1000);

    this.broadcastViewerSnapshots();
  }

  /**
   * Broadcasts viewer-specific sanitized snapshots to all participants and spectators
   */
  public broadcastViewerSnapshots(): void {
    for (const player of this.players) {
      const snapshot = this.getViewerSnapshot(player.userId);
      this.io.to(player.userId).emit('game:state', snapshot);
    }

    // Broadcast to spectators in the room
    const room = RoomManager.getInstance().getRoomSession(this.roomCode);
    if (room && room.spectators) {
      for (const spectator of room.spectators.values()) {
        const snapshot = this.getViewerSnapshot(spectator.userId);
        this.io.to(spectator.socketId).emit('game:state', snapshot);
      }
    }
  }

  /**
   * Returns a sanitized viewer-specific game state snapshot (never leaks secret word or imposter role to observers)
   */
  public getViewerSnapshot(viewerUserId: string): SanitizedGameSnapshot {
    const isDrawer = viewerUserId === this.currentDrawerId;
    const isPlayer = this.players.some((p) => p.userId === viewerUserId);
    const isSpectator = !isPlayer;
    const drawer = this.players.find((p) => p.userId === this.currentDrawerId);
    const imposterUser = this.players.find((p) => p.userId === this.imposterUserId);

    const sortedScores = Array.from(this.scores.values()).sort((a, b) => b.score - a.score);
    const topScore = sortedScores[0]?.score ?? 0;
    const tiedWinners = sortedScores.filter((s) => s.score === topScore);

    const winner =
      this.phase === 'game_over'
        ? {
            userId: sortedScores[0]?.userId || '',
            displayName: tiedWinners.length > 1
              ? tiedWinners.map((w) => w.displayName).join(' & ')
              : sortedScores[0]?.displayName || 'Winner',
            score: topScore,
            isTie: tiedWinners.length > 1,
          }
        : undefined;

    // Word visibility rules:
    // Classic: drawer or round_ending/game_over
    // Imposter: non-imposters receive secretWord during turns; imposter & spectators only receive category clue
    let secretWordView: string | undefined = undefined;
    if (this.gameMode === 'imposter') {
      if (this.phase === 'imposter_results' || this.phase === 'game_over') {
        secretWordView = this.secretWord;
      } else if (isPlayer && viewerUserId !== this.imposterUserId) {
        secretWordView = this.secretWord;
      }
    } else {
      if (isDrawer || this.phase === 'round_ending' || this.phase === 'game_over') {
        secretWordView = this.secretWord;
      }
    }

    const wordData = {
      secret: secretWordView,
      choices: isDrawer && this.phase === 'word_selection' ? this.wordChoices : undefined,
      masked: this.secretWord
        ? WordService.generateMask(this.secretWord, this.revealedHintIndices, this.wordMode)
        : '',
      revealedIndices: this.wordMode === 'hidden' ? [] : [...this.revealedHintIndices],
      length: this.secretWord.length,
    };

    // Imposter Mode state view (strict role privacy enforcement)
    let imposterState: ImposterStateSnapshot | undefined = undefined;
    if (this.gameMode === 'imposter') {
      const showResults = this.phase === 'imposter_results' || this.phase === 'game_over';
      const showDrawings = this.phase === 'imposter_voting' || showResults;

      imposterState = {
        role: isPlayer ? (viewerUserId === this.imposterUserId ? 'imposter' : 'innocent') : undefined,
        categoryClue: this.categoryClue,
        currentDrawingTurnIndex: this.imposterDrawingTurnIndex + 1,
        totalDrawingTurns: this.players.length,
        activeDrawingPlayerId: this.currentDrawerId,
        activeDrawingPlayerName: drawer?.displayName,
        revealedDrawings: showDrawings ? this.imposterRevealedDrawings : undefined,
        hasVoted: this.imposterVotes.has(viewerUserId),
        votedForUserId: this.imposterVotes.get(viewerUserId),
        voteTimeSeconds: this.timerDurationSeconds,
        identifiedImposterId: showResults ? this.imposterUserId : undefined,
        identifiedImposterName: showResults ? imposterUser?.displayName : undefined,
        wasImposterCaught: showResults ? this.wasImposterCaught : undefined,
        voteTallies: showResults ? this.voteTallies : undefined,
        votersForImposter: showResults ? this.votersForImposter : undefined,
      };
    }

    return {
      gameId: this.gameId,
      roomCode: this.roomCode,
      gameMode: this.gameMode,
      phase: this.phase,
      currentRound: this.currentRound,
      totalRounds: this.totalRounds,
      drawerId: this.currentDrawerId,
      drawerName: drawer?.displayName || 'Drawer',
      turnIndex: this.currentTurnIndex + 1,
      totalTurnsInRound: this.players.length,
      timer: {
        durationSeconds: this.timerDurationSeconds,
        startedAt: this.timerStartedAt,
        deadline: this.timerDeadline,
      },
      word: wordData,
      scores: sortedScores,
      recentGuesses: [...this.recentGuesses],
      lastRoundSummary: this.lastRoundSummary,
      winner,
      imposterState,
      revision: this.revision,
      wordMode: this.wordMode,
      wordLanguage: this.wordLanguage,
      isSpectator,
    };
  }

  private clearAllTimers(): void {
    if (this.activeTimer) {
      clearTimeout(this.activeTimer);
      this.activeTimer = undefined;
    }
    this.hintTimeouts.forEach((t) => clearTimeout(t));
    this.hintTimeouts = [];
    if (this.afkWarningTimer) {
      clearTimeout(this.afkWarningTimer);
      this.afkWarningTimer = undefined;
    }
    if (this.afkSkipTimer) {
      clearTimeout(this.afkSkipTimer);
      this.afkSkipTimer = undefined;
    }
    this.afkWarningIssued = false;
  }
}
