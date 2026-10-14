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

export interface ImposterRevealDrawing {
  turnIndex: number;
  drawerId: string;
  drawerName: string;
  strokes: any[];
}

export interface ImposterStateSnapshot {
  role?: 'imposter' | 'innocent';
  categoryClue?: string;
  currentDrawingTurnIndex: number;
  totalDrawingTurns: number;
  activeDrawingPlayerId?: string;
  activeDrawingPlayerName?: string;
  revealedDrawings?: ImposterRevealDrawing[];
  votedUserIds?: string[];
  wasImposterCaught?: boolean;
  revealedImposterUserId?: string;
  revealedImposterName?: string;
  votersForImposter?: string[];
}

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

export interface SanitizedGameSnapshot {
  gameId: string;
  roomCode: string;
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
  gameMode?: GameMode;
  imposter?: ImposterStateSnapshot;
  imposterState?: ImposterStateSnapshot;
  revision: number;
}
