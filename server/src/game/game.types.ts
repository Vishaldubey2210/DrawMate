export type GameMode = 'classic' | 'imposter';

export type GamePhase =
  | 'waiting'
  | 'word_selection'
  | 'drawing'
  | 'round_ending'
  | 'game_over'
  | 'cancelled'
  | 'imposter_drawing'
  | 'imposter_reveal'
  | 'imposter_voting'
  | 'imposter_results';

export interface PlayerScore {
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  score: number;
  roundScore: number;
  correctGuesses: number;
  drawingTurns: number;
}

export interface GuessMessage {
  id: string;
  userId: string;
  displayName: string;
  text: string;
  isCorrect: boolean;
  timestamp: number;
}

export interface RoundSummary {
  roundNumber: number;
  drawerId: string;
  drawerName: string;
  secretWord: string;
  winnerId?: string;
  winnerName?: string;
  reason: 'guessed' | 'timeout' | 'cancelled' | 'afk_skip';
  pointsAwarded: Record<string, number>;
}

export interface ImposterRevealDrawing {
  turnIndex: number;
  drawerId: string;
  drawerName: string;
  strokes: any[];
}

export interface ImposterStateSnapshot {
  role?: 'imposter' | 'innocent'; // viewer's own role only, never others'
  categoryClue?: string; // category shown to imposter and spectators
  currentDrawingTurnIndex: number;
  totalDrawingTurns: number;
  activeDrawingPlayerId?: string;
  activeDrawingPlayerName?: string;
  revealedDrawings?: ImposterRevealDrawing[];
  currentRevealIndex?: number;
  hasVoted?: boolean;
  votedForUserId?: string;
  voteTimeSeconds?: number;
  identifiedImposterId?: string; // only revealed in imposter_results & game_over
  identifiedImposterName?: string; // only revealed in imposter_results & game_over
  wasImposterCaught?: boolean; // only revealed in imposter_results & game_over
  voteTallies?: Record<string, number>; // votes per player in results phase
  votersForImposter?: string[];
}

export interface SanitizedGameSnapshot {
  gameId: string;
  roomCode: string;
  gameMode?: GameMode;
  phase: GamePhase;
  currentRound: number;
  totalRounds: number;
  drawerId: string;
  drawerName: string;
  turnIndex: number;
  totalTurnsInRound: number;
  timer: {
    durationSeconds: number;
    startedAt: number;
    deadline: number;
  };
  word: {
    secret?: string;
    choices?: string[];
    masked: string;
    revealedIndices: number[];
    length: number;
  };
  scores: PlayerScore[];
  recentGuesses: GuessMessage[];
  lastRoundSummary?: RoundSummary;
  winner?: {
    userId: string;
    displayName: string;
    score: number;
    isTie?: boolean;
  };
  imposterState?: ImposterStateSnapshot;
  revision: number;
  wordMode?: 'normal' | 'hidden' | 'combination';
  wordLanguage?: 'en' | 'hi' | 'es';
  isSpectator?: boolean;
}
